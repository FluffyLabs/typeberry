import type { Block } from "@typeberry/block";
import { InMemoryBlocks, InMemoryKvdb } from "../../packages/database";
import type { TransitionHasher } from "../../packages/transition";

export class Importer {
  private readonly blocks: InMemoryBlocks;
  private readonly state: InMemoryKvdb;

  constructor(hasher: TransitionHasher) {
    this.blocks = new InMemoryBlocks(hasher);
    this.state = new InMemoryKvdb();
  }

  importBlock(b: Block) {
    // TODO [ToDr] verify block?
    // TODO [ToDr] execute block and populate the state.
    this.blocks.insert(b);
  }

  bestBlockHeader() {
    return this.blocks.bestBlock()?.header;
  }
}
