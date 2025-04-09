import type { BlockView, HeaderHash, HeaderView } from "@typeberry/block";
import { type BlocksDb, InMemoryKvdb } from "@typeberry/database";
import { WithHash } from "@typeberry/hash";
import type { TransitionHasher } from "@typeberry/transition";

export class Importer {
  private readonly state: InMemoryKvdb;

  constructor(
    private readonly hasher: TransitionHasher,
    private readonly blocks: BlocksDb,
  ) {
    this.state = new InMemoryKvdb();
  }

  async importBlock(b: BlockView): Promise<WithHash<HeaderHash, HeaderView>> {
    // TODO [ToDr] verify block?
    // TODO [ToDr] execute block and populate the state.
    const headerWithHash = this.hasher.header(b.header.view());
    await this.blocks.insertBlock(new WithHash(headerWithHash.hash, b));
    await this.blocks.setBestHeaderHash(headerWithHash.hash);
    return headerWithHash;
  }

  bestBlockHash() {
    return this.blocks.getBestHeaderHash();
  }
}
