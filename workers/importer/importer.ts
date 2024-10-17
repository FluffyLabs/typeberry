import { type BlockView, type Header, type HeaderHash, WithHash } from "@typeberry/block";
import { InMemoryKvdb } from "../../packages/database";
import type { LmdbBlocks } from "../../packages/database-lmdb";
import type { TransitionHasher } from "../../packages/transition";

export class Importer {
  private readonly state: InMemoryKvdb;

  constructor(
    private readonly hasher: TransitionHasher,
    private readonly blocks: LmdbBlocks,
  ) {
    this.state = new InMemoryKvdb();
  }

  async importBlock(b: BlockView): Promise<WithHash<HeaderHash, Header>> {
    // TODO [ToDr] verify block?
    // TODO [ToDr] execute block and populate the state.
    const headerWithHash = this.hasher.header(b.header());
    const done = await this.blocks.insertBlock(new WithHash(headerWithHash.hash, b));
    await this.blocks.setBestHeaderHash(headerWithHash.hash);

    if (done[0] && done[1]) {
      return headerWithHash;
    }
    throw new Error("Error writing to the db.");
  }

  bestBlockHash() {
    return this.blocks.getBestHeaderHash();
  }
}
