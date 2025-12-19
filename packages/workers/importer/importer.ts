import { type BlockView, type HeaderHash, type HeaderView, type StateRootHash, tryAsTimeSlot } from "@typeberry/block";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type { BlocksDb, LeafDb, StatesDb, StateUpdateError } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import type { Logger } from "@typeberry/logger";
import type { SerializedState } from "@typeberry/state-merkleization";
import type { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier, BlockVerifierError } from "@typeberry/transition/block-verifier.js";
import { DbHeaderChain, OnChain, type StfError } from "@typeberry/transition/chain-stf.js";
import { type ErrorResult, measure, now, Result, resultToString, type TaggedError } from "@typeberry/utils";
import * as metrics from "./metrics.js";

export enum ImporterErrorKind {
  Verifier = 0,
  Stf = 1,
  Update = 2,
}

export type ImporterError =
  | TaggedError<ImporterErrorKind.Verifier, BlockVerifierError>
  | TaggedError<ImporterErrorKind.Stf, StfError>
  | TaggedError<ImporterErrorKind.Update, StateUpdateError>;

const importerError = <Kind extends ImporterErrorKind, Err extends ImporterError["error"]>(
  kind: Kind,
  nested: ErrorResult<Err>,
) => Result.taggedError<WithHash<HeaderHash, HeaderView>, Kind, Err>(ImporterErrorKind, kind, nested);

export class Importer {
  private readonly verifier: BlockVerifier;
  private readonly stf: OnChain;

  // TODO [ToDr] we cannot assume state reference does not change.
  private readonly state: SerializedState<LeafDb>;
  // Hash of the block that we have the posterior state for in `state`.
  private currentHash: HeaderHash;
  private readonly metrics: ReturnType<typeof metrics.createMetrics>;

  constructor(
    spec: ChainSpec,
    pvm: PvmBackend,
    private readonly hasher: TransitionHasher,
    private readonly logger: Logger,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb<SerializedState<LeafDb>>,
  ) {
    this.metrics = metrics.createMetrics();
    const currentBestHeaderHash = this.blocks.getBestHeaderHash();
    const state = states.getState(currentBestHeaderHash);
    if (state === null) {
      throw new Error(`Unable to load best state from header hash: ${currentBestHeaderHash}.`);
    }

    this.verifier = new BlockVerifier(hasher, blocks);
    this.stf = new OnChain(spec, state, hasher, { pvm, accumulateSequentially: false }, DbHeaderChain.new(blocks));
    this.state = state;
    this.currentHash = currentBestHeaderHash;
    this.prepareForNextEpoch();

    logger.info`😎 Best time slot: ${state.timeslot} (header hash: ${currentBestHeaderHash})`;
  }

  /** Do some extra work for preparation for the next epoch. */
  public async prepareForNextEpoch() {
    try {
      await this.stf.prepareForNextEpoch();
    } catch (e) {
      this.logger.error`Unable to prepare for next epoch: ${e}`;
    }
  }

  // TODO [ToDr] import block and get state root
  public async importBlockWithStateRoot(block: BlockView): Promise<Result<StateRootHash, ImporterError>> {
    const res = await this.importBlock(block);
    if (res.isOk) {
      return Result.ok(this.state.backend.getStateRoot(this.hasher.blake2b));
    }
    return res;
  }

  public async importBlock(block: BlockView): Promise<Result<WithHash<HeaderHash, HeaderView>, ImporterError>> {
    const timer = measure("importBlock");
    const timeSlot = extractTimeSlot(block);

    this.metrics.recordBlockImportingStarted(timeSlot);

    const startTime = now();
    const maybeBestHeader = await this.importBlockInternal(block);
    const duration = now() - startTime;

    if (maybeBestHeader.isOk) {
      const bestHeader = maybeBestHeader.ok;
      this.logger.info`🧊 Best block: #${timeSlot} (${bestHeader.hash})`;
      this.logger.log`${timer()}`;
      this.metrics.recordBlockImportComplete(duration, true);
      return maybeBestHeader;
    }

    this.logger.log`❌ Rejected block #${timeSlot}: ${resultToString(maybeBestHeader)}`;
    this.logger.log`${timer()}`;
    this.metrics.recordBlockImportComplete(duration, false);
    return maybeBestHeader;
  }

  private async importBlockInternal(
    block: BlockView,
  ): Promise<Result<WithHash<HeaderHash, HeaderView>, ImporterError>> {
    const logger = this.logger;
    logger.log`🧱 Attempting to import a new block`;

    const timerVerify = measure("import:verify");
    const verifyStart = now();
    const hash = await this.verifier.verifyBlock(block);
    const verifyDuration = now() - verifyStart;
    logger.log`${timerVerify()}`;
    if (hash.isError) {
      this.metrics.recordBlockVerificationFailed(resultToString(hash));
      return importerError(ImporterErrorKind.Verifier, hash);
    }
    this.metrics.recordBlockVerified(verifyDuration);

    // TODO [ToDr] This is incomplete/temporary fork support!
    const parentHash = block.header.view().parentHeaderHash.materialize();
    if (!this.currentHash.isEqualTo(parentHash)) {
      const state = this.states.getState(parentHash);
      if (state === null) {
        const e = Result.error(
          BlockVerifierError.StateRootNotFound,
          () => `State not found for parent block ${parentHash}`,
        );
        if (!e.isError) {
          throw new Error("unreachable, just adding to make compiler happy");
        }
        return importerError(ImporterErrorKind.Verifier, e);
      }
      this.state.updateBackend(state?.backend);
      this.prepareForNextEpoch();
      this.currentHash = parentHash;
    }

    const timeSlot = block.header.view().timeSlotIndex.materialize();
    const headerHash = hash.ok;
    logger.log`🧱 Verified block: Got hash ${headerHash} for block at slot ${timeSlot}.`;
    const timerStf = measure("import:stf");
    const stfStart = now();
    const res = await this.stf.transition(block, headerHash);
    const stfDuration = now() - stfStart;
    logger.log`${timerStf()}`;
    if (res.isError) {
      this.metrics.recordBlockExecutionFailed(resultToString(res));
      return importerError(ImporterErrorKind.Stf, res);
    }
    this.metrics.recordBlockExecuted(stfDuration, 0);
    // modify the state
    const update = res.ok;
    const timerState = measure("import:state");
    const updateResult = await this.states.updateAndSetState(headerHash, this.state, update);
    if (updateResult.isError) {
      logger.error`🧱 Unable to update state: ${resultToString(updateResult)}`;
      return importerError(ImporterErrorKind.Update, updateResult);
    }

    this.prepareForNextEpoch();
    this.currentHash = headerHash;
    logger.log`${timerState()}`;

    // insert new state and the block to DB.
    const timerDb = measure("import:db");
    const writeBlocks = this.blocks.insertBlock(new WithHash(headerHash, block));

    // Computation of the state root may happen asynchronously,
    // but we still need to wait for it before next block can be imported
    const stateRoot = await this.states.getStateRoot(this.state);
    logger.log`🧱 Storing post-state-root for ${headerHash}: ${stateRoot}.`;
    const writeStateRoot = this.blocks.setPostStateRoot(headerHash, stateRoot);

    await Promise.all([writeBlocks, writeStateRoot]);
    logger.log`${timerDb()}`;
    // finally update the best block
    await this.blocks.setBestHeaderHash(headerHash);

    return Result.ok(new WithHash(headerHash, block.header.view()));
  }

  getBestStateRootHash() {
    const bestHeaderHash = this.blocks.getBestHeaderHash();
    const stateRoot = this.blocks.getPostStateRoot(bestHeaderHash);
    return stateRoot;
  }

  getBestBlockHash() {
    return this.blocks.getBestHeaderHash();
  }

  getStateEntries(headerHash: HeaderHash) {
    const state = this.states.getState(headerHash);
    const stateEntries = state?.backend.intoStateEntries();
    return stateEntries ?? null;
  }
  async close() {
    await this.blocks.close();
    await this.states.close();
  }
}

/**
 * Attempt to safely extract timeslot of a block.
 *
 * NOTE: it may fail if encoding is invalid.
 */
function extractTimeSlot(block: BlockView) {
  try {
    return block.header.view().timeSlotIndex.materialize();
  } catch {
    return tryAsTimeSlot(2 ** 32 - 1);
  }
}
