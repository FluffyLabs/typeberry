import type { BlockView, HeaderHash, HeaderView } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import type { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verification";
import { OnChain } from "@typeberry/transition/chain-stf";

export class Importer {
  private readonly verifier: BlockVerifier;
  private readonly stf: OnChain;

  constructor(
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
    private readonly spec: ChainSpec,
    hasher: TransitionHasher,
  ) {
    const currentStateRootHash = this.blocks.getBestData()[1];
    const state = states.getFullState(currentStateRootHash);
    if (state === null) {
      throw new Error(`Unable to load best state from hash: ${currentStateRootHash}.`);
    }

    this.verifier = new BlockVerifier(hasher);
    this.stf = new OnChain(spec, state, blocks, hasher);
  }

  async importBlock(block: BlockView): Promise<WithHash<HeaderHash, HeaderView>> {
    const hash = await this.verifier.verifyBlock(block);
    if (hash.isError) {
      // TODO [ToDr] this should be a `Result.error`?
      throw new Error(`Block verification failure: ${hash.error} - ${hash.details}.`);
    }
    const headerHash = hash.ok;
    const res = await this.stf.transition(block, headerHash);
    if (res.isError) {
      throw new Error(`Block transition failure: ${res.error} - ${res.details}.`);
    }
    const stateRoot = merkelizeState(serializeState(this.stf.state, this.spec));
    const writeState = this.states.insertFullState(stateRoot, this.stf.state);
    const writeBlocks = this.blocks.insertBlock(new WithHash(headerHash, block));
    await writeState;
    await writeBlocks;
    await this.blocks.setBestData(headerHash, stateRoot);
    return new WithHash(headerHash, block.header.view());
  }

  bestBlockHash() {
    return this.blocks.getBestData()[0];
  }
}
