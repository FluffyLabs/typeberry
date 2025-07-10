import type { BlockView, ExtrinsicView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";

/**
 * Blockchain database interface.
 */
export interface BlocksDb {
  /** Mark given header hash as the best block. */
  setBestHeaderHash(hash: HeaderHash): Promise<void>;
  /** Retrieve current best header hash. */
  getBestHeaderHash(): HeaderHash;
  /** Set the posterior state root hash of given block. */
  setPostStateRoot(hash: HeaderHash, postStateRoot: StateRootHash): Promise<void>;
  /** Get posterior state root of given block hash. */
  getPostStateRoot(hash: HeaderHash): StateRootHash | null;
  /** Insert and flush a new block into the database. */
  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void>;
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
  private readonly postStateRootByHeaderHash: HashDictionary<HeaderHash, StateRootHash> = HashDictionary.new();
  private bestHeaderHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();

  /** Create empty blocks db. */
  static new() {
    return new InMemoryBlocks();
  }

  /** Create new `InMemoryBlocks` and insert all given blocks. */
  static fromBlocks(previousBlocks: WithHash<HeaderHash, BlockView>[]) {
    const blocksDb = InMemoryBlocks.new();
    for (const block of previousBlocks) {
      blocksDb.insertBlock(block);
    }
    return blocksDb;
  }

  setBestHeaderHash(hash: HeaderHash): Promise<void> {
    this.bestHeaderHash = hash;

    return Promise.resolve();
  }

  getBestHeaderHash(): HeaderHash {
    return this.bestHeaderHash;
  }

  setPostStateRoot(hash: HeaderHash, postStateRoot: StateRootHash): Promise<void> {
    this.postStateRootByHeaderHash.set(hash, postStateRoot);
    return Promise.resolve();
  }

  getPostStateRoot(hash: HeaderHash): StateRootHash | null {
    return this.postStateRootByHeaderHash.get(hash) ?? null;
  }

  insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    this.headersByHash.set(block.hash, block.data.header.view());
    this.extrinsicsByHeaderHash.set(block.hash, block.data.extrinsic.view());

    return Promise.resolve();
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    return this.headersByHash.get(hash) ?? null;
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    return this.extrinsicsByHeaderHash.get(hash) ?? null;
  }
}
