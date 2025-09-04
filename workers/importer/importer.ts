import type { BlockView, EntropyHash, HeaderHash, HeaderView, TimeSlot } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, LeafDb, StateUpdateError, StatesDb } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import type { Logger } from "@typeberry/logger";
import type { SerializedState } from "@typeberry/state-merkleization";
import type { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier, type BlockVerifierError } from "@typeberry/transition/block-verifier.js";
import { OnChain, type StfError } from "@typeberry/transition/chain-stf.js";
import { type ErrorResult, Result, type TaggedError, measure, resultToString } from "@typeberry/utils";

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

  constructor(
    spec: ChainSpec,
    hasher: TransitionHasher,
    private readonly logger: Logger,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb<SerializedState<LeafDb>>,
  ) {
    const currentBestHeaderHash = this.blocks.getBestHeaderHash();
    const state = states.getState(currentBestHeaderHash);
    if (state === null) {
      throw new Error(`Unable to load best state from header hash: ${currentBestHeaderHash}.`);
    }

    this.verifier = new BlockVerifier(hasher, blocks);
    this.stf = new OnChain(spec, state, blocks, hasher, { enableParallelSealVerification: true });
    this.state = state;

    logger.info(`😎 Best time slot: ${state.timeslot} (header hash: ${currentBestHeaderHash})`);
  }

  /** Attempt to pre-verify the seal to speed up importing. */
  async preverifySeal(timeSlot: TimeSlot, block: BlockView): Promise<EntropyHash | null> {
    try {
      const res = await this.stf.verifySeal(timeSlot, block);
      if (res.isOk) {
        return res.ok;
      }
      this.logger.warn(`Unable to pre-verify the seal: ${resultToString(res)}`);
      return null;
    } catch (e) {
      this.logger.warn(`Error while trying to pre-verify the seal: ${e}`);
      return null;
    }
  }

  async importBlock(
    block: BlockView,
    preverifiedSeal: EntropyHash | null,
    omitSealVerification = false,
  ): Promise<Result<WithHash<HeaderHash, HeaderView>, ImporterError>> {
    const logger = this.logger;
    logger.log(`🧱 Attempting to import a new block ${preverifiedSeal !== null ? "(seal preverified)" : ""}`);

    const timerVerify = measure("import:verify");
    const hash = await this.verifier.verifyBlock(block);
    logger.log(timerVerify());
    if (hash.isError) {
      return importerError(ImporterErrorKind.Verifier, hash);
    }

    const timeSlot = block.header.view().timeSlotIndex.materialize();
    const headerHash = hash.ok;
    logger.log(`🧱 Verified block: Got hash ${headerHash} for block at slot ${timeSlot}.`);
    const timerStf = measure("import:stf");
    const res = await this.stf.transition(block, headerHash, preverifiedSeal, omitSealVerification);
    logger.log(timerStf());
    if (res.isError) {
      return importerError(ImporterErrorKind.Stf, res);
    }
    // modify the state
    const update = res.ok;
    const timerState = measure("import:state");
    const updateResult = await this.states.updateAndSetState(headerHash, this.state, update);
    if (updateResult.isError) {
      logger.error(`🧱 Unable to update state: ${resultToString(updateResult)}`);
      return importerError(ImporterErrorKind.Update, updateResult);
    }
    const newState = this.states.getState(headerHash);

    if (newState === null) {
      throw new Error("Freshly updated state not in the DB?");
    }
    // TODO [ToDr] This is a temporary measure. We should rather read
    // the state of a parent block to support forks and create a fresh STF.
    this.state.updateBackend(newState.backend);
    logger.log(timerState());

    // insert new state and the block to DB.
    const timerDb = measure("import:db");
    const writeBlocks = this.blocks.insertBlock(new WithHash(headerHash, block));

    // Computation of the state root may happen asynchronously,
    // but we still need to wait for it before next block can be imported
    const stateRoot = await this.states.getStateRoot(newState);
    logger.log(`🧱 Storing post-state-root for ${headerHash}: ${stateRoot}.`);
    const writeStateRoot = this.blocks.setPostStateRoot(headerHash, stateRoot);

    await Promise.all([writeBlocks, writeStateRoot]);
    logger.log(timerDb());
    // finally update the best block
    await this.blocks.setBestHeaderHash(headerHash);

    return Result.ok(new WithHash(headerHash, block.header.view()));
  }

  getBestStateRootHash() {
    return this.blocks.getPostStateRoot(this.blocks.getBestHeaderHash());
  }

  getBestBlockHash() {
    return this.blocks.getBestHeaderHash();
  }

  getStateEntries(headerHash: HeaderHash) {
    const state = this.states.getState(headerHash);
    const stateEntries = state?.backend.intoStateEntries();
    return stateEntries ?? null;
  }
}
