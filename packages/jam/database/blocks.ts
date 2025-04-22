import type { BlockView, ExtrinsicView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";

/**
 * Blockchain database interface.
 */
export interface BlocksDb {
  /** Insert and flush a new block into the database. */
  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void>;
  /** Mark given header hash as the best block along with it's posterior state root. */
  setBestData(hash: HeaderHash, posteriorStateRoot: StateRootHash): Promise<void>;
  /** Retrieve current best header hash and posterior state root. */
  getBestData(): [HeaderHash, StateRootHash];
  /** Retrieve header by hash. */
  getHeader(hash: HeaderHash): HeaderView | null;
  /**
   * Retrieve extrinsic data by hash of the header they are part of.
   *
   * NOTE: this is not extrinsic hash!
   */
  getExtrinsic(hash: HeaderHash): ExtrinsicView | null;
}

/** In-memory (non-persistent) blocks database. */
export class InMemoryBlocks implements BlocksDb {
  private readonly headersByHash: HashDictionary<HeaderHash, HeaderView> = HashDictionary.new();
  private readonly extrinsicsByHeaderHash: HashDictionary<HeaderHash, ExtrinsicView> = HashDictionary.new();
  private bestHeaderHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();
  private bestPostStateRoot: StateRootHash = Bytes.zero(HASH_SIZE).asOpaque();

  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    this.headersByHash.set(block.hash, block.data.header.view());
    this.extrinsicsByHeaderHash.set(block.hash, block.data.extrinsic.view());

    return Promise.resolve();
  }

  setBestData(hash: HeaderHash, postStateRoot: StateRootHash): Promise<void> {
    this.bestHeaderHash = hash;
    this.bestPostStateRoot = postStateRoot;

    return Promise.resolve();
  }

  getBestData(): [HeaderHash, StateRootHash] {
    return [this.bestHeaderHash, this.bestPostStateRoot];
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    return this.headersByHash.get(hash) ?? null;
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    return this.extrinsicsByHeaderHash.get(hash) ?? null;
  }
}
