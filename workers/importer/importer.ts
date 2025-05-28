import type { BlockView, HeaderHash, HeaderView } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import type { Logger } from "@typeberry/logger";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import type { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier, type BlockVerifierError } from "@typeberry/transition/block-verifier";
import { OnChain, type StfError } from "@typeberry/transition/chain-stf";
import { type ErrorResult, Result, type TaggedError, measure } from "@typeberry/utils";

export enum ImporterErrorKind {
  Verifier = 0,
  Stf = 1,
}

export type ImporterError =
  | TaggedError<ImporterErrorKind.Verifier, BlockVerifierError>
  | TaggedError<ImporterErrorKind.Stf, StfError>;

const importerError = <Kind extends ImporterErrorKind, Err extends ImporterError["error"]>(
  kind: Kind,
  nested: ErrorResult<Err>,
) => Result.taggedError<WithHash<HeaderHash, HeaderView>, Kind, Err>(ImporterErrorKind, kind, nested);

export class Importer {
  private readonly verifier: BlockVerifier;
  private readonly stf: OnChain;

  constructor(
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
    private readonly spec: ChainSpec,
    hasher: TransitionHasher,
    private readonly logger: Logger,
  ) {
    const currentStateRootHash = this.blocks.getBestData()[1];
    const state = states.getFullState(currentStateRootHash);
    if (state === null) {
      throw new Error(`Unable to load best state from hash: ${currentStateRootHash}.`);
    }

    this.verifier = new BlockVerifier(hasher, blocks);
    this.stf = new OnChain(spec, state, blocks, hasher);

    logger.info(`😎 Best time slot: ${state.timeslot} (state root: ${currentStateRootHash})`);
  }

  async importBlock(block: BlockView): Promise<Result<WithHash<HeaderHash, HeaderView>, ImporterError>> {
    const logger = this.logger;
    logger.log("🧱 Attempting to import a new block.");

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
    const res = await this.stf.transition(block, headerHash);
    logger.log(timerStf());
    if (res.isError) {
      // TODO [ToDr] Revert the state?
      return importerError(ImporterErrorKind.Stf, res);
    }

    const timerState = measure("import:state");
    const stateRoot = merkelizeState(serializeState(this.stf.state, this.spec));
    logger.log(timerState());
    // insert new state and the block to DB.
    const timerDb = measure("import:db");
    const writeState = this.states.insertFullState(stateRoot, this.stf.state);
    const writeBlocks = this.blocks.insertBlock(new WithHash(headerHash, block));
    // insert posterior state root, since we know it now.
    const writePostState = this.blocks.setPostStateRoot(headerHash, stateRoot);

    await Promise.all([writeState, writeBlocks, writePostState]);
    await this.blocks.setBestData(headerHash, stateRoot);
    logger.log(timerDb());

    return Result.ok(new WithHash(headerHash, block.header.view()));
  }

  bestBlockHash() {
    return this.blocks.getBestData()[0];
  }
}
