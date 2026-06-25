import {
  type BlockView,
  Extrinsic,
  type ExtrinsicView,
  Header,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
} from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database/blocks.js";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { FjallRoot, type FjallPartition, type Partition, toUint8Array } from "./root.js";

const BEST_BLOCK = new TextEncoder().encode("best hash and posterior state root");
const logger = Logger.new(import.meta.filename, "db");

/** fjall-backed block storage. */
export class FjallBlocks implements BlocksDb {
  static async open(chainSpec: ChainSpec, root: FjallRoot): Promise<FjallBlocks> {
    const [headers, extrinsics, postStateRoots] = await Promise.all([
      root.partition("headers"),
      root.partition("extrinsics"),
      root.partition("postStateRoots"),
    ]);
    return new FjallBlocks(chainSpec, root, headers, extrinsics, postStateRoots);
  }

  private constructor(
    private readonly chainSpec: ChainSpec,
    private readonly root: FjallRoot,
    private readonly headers: FjallPartition,
    private readonly extrinsics: FjallPartition,
    private readonly postStateRoots: FjallPartition,
  ) {}

  async setPostStateRoot(hash: HeaderHash, postStateRoot: StateRootHash): Promise<void> {
    await writable(this.postStateRoots).insert(hash.raw, postStateRoot.raw);
  }

  getPostStateRoot(hash: HeaderHash): StateRootHash | null {
    const postStateRoot = toUint8Array(this.postStateRoots.get(hash.raw));
    if (postStateRoot === null) {
      return null;
    }
    return Bytes.fromBlob(postStateRoot, HASH_SIZE).asOpaque();
  }

  async insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    await Promise.all([
      writable(this.headers).insert(block.hash.raw, block.data.header.view().encoded().raw),
      writable(this.extrinsics).insert(block.hash.raw, block.data.extrinsic.view().encoded().raw),
    ]);
  }

  async setBestHeaderHash(hash: HeaderHash): Promise<void> {
    await writable(this.headers).insert(BEST_BLOCK, hash.raw);
    await this.root.persist();
  }

  getBestHeaderHash(): HeaderHash {
    const bestHeaderHash = toUint8Array(this.headers.get(BEST_BLOCK));
    if (bestHeaderHash === null) {
      return Bytes.zero(HASH_SIZE).asOpaque();
    }
    return Bytes.fromBlob(bestHeaderHash, HASH_SIZE).asOpaque();
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    const data = toUint8Array(this.headers.get(hash.raw));
    if (data === null) {
      return null;
    }
    return Decoder.decodeObject(Header.Codec.View, data, this.chainSpec);
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    const data = toUint8Array(this.extrinsics.get(hash.raw));
    if (data === null) {
      return null;
    }
    return Decoder.decodeObject(Extrinsic.Codec.View, data, this.chainSpec);
  }

  markUnused(hash: HeaderHash): void {
    void Promise.all([
      writable(this.headers).remove(hash.raw),
      writable(this.extrinsics).remove(hash.raw),
      writable(this.postStateRoots).remove(hash.raw),
    ]).catch((e) => logger.warn`Failed to prune block ${hash}: ${e}`);
  }

  async close() {}
}

function writable(partition: FjallPartition): Partition {
  if (!("insert" in partition)) {
    throw new Error("Cannot write through a read-only fjall partition.");
  }
  return partition;
}
