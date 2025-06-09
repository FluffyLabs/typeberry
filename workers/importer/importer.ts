import type { BlockView, EntropyHash, HeaderHash, HeaderView, TimeSlot } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb, StateUpdateError } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import type { Logger } from "@typeberry/logger";
import type { State } from "@typeberry/state";
import type { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier, type BlockVerifierError } from "@typeberry/transition/block-verifier";
import { OnChain, type StfError } from "@typeberry/transition/chain-stf";
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
  private state: State;

  constructor(
    spec: ChainSpec,
    hasher: TransitionHasher,
    private readonly logger: Logger,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
  ) {
    const currentBestHeaderHash = this.blocks.getBestData()[0];
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
    logger.log(`🧱 Got hash ${hash.ok} for block at slot ${timeSlot}.`);
    const headerHash = hash.ok;
    const timerStf = measure("import:stf");
    const res = await this.stf.transition(block, headerHash, preverifiedSeal);
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
    this.state = updateResult.ok;
    logger.log(timerState());

    // insert new state and the block to DB.
    const timerDb = measure("import:db");
    const writeBlocks = this.blocks.insertBlock(new WithHash(headerHash, block));
    // insert posterior state root, since we know it now.
    const stateRoot = this.states.getStateRoot(this.state);
    const writePostState = this.blocks.setPostStateRoot(headerHash, stateRoot);

    await Promise.all([writeBlocks, writePostState]);
    await this.blocks.setBestData(headerHash, stateRoot);
    logger.log(timerDb());

    return Result.ok(new WithHash(headerHash, block.header.view()));
  }

  bestBlockHash() {
    return this.blocks.getBestData()[0];
  }
}
