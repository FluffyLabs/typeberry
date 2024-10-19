import { HASH_SIZE, type BlockView, type ExtrinsicView, type HeaderHash, type HeaderView, type WithHash } from "@typeberry/block";
import { HashDictionary } from "@typeberry/collections";
import {Bytes} from "@typeberry/bytes";

export interface BlocksDb {
  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void>;

  setBestHeaderHash(hash: HeaderHash): Promise<void>;

  getBestHeaderHash(): HeaderHash;

  getHeader(hash: HeaderHash): HeaderView | null;

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null;
}

export class InMemoryBlocks implements BlocksDb {
  private readonly headersByHash: HashDictionary<HeaderHash, HeaderView> = new HashDictionary();
  private readonly extrinsicsByHeaderHash: HashDictionary<HeaderHash, ExtrinsicView> = new HashDictionary();
  private bestHeaderHash = Bytes.zero(HASH_SIZE) as HeaderHash;

  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    this.headersByHash.set(block.hash, block.data.headerView() as HeaderView);
    this.extrinsicsByHeaderHash.set(block.hash, block.data.extrinsicView() as ExtrinsicView);

    return Promise.resolve();
  }

  setBestHeaderHash(hash: HeaderHash): Promise<void> {
    this.bestHeaderHash = hash;

    return Promise.resolve();
  }

  getBestHeaderHash(): HeaderHash {
    return this.bestHeaderHash;
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    return this.headersByHash.get(hash) ?? null;
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    return this.extrinsicsByHeaderHash.get(hash) ?? null;
  }
}
