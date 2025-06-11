import {
  type BlockView,
  Extrinsic,
  type ExtrinsicView,
  Header,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database/blocks.js";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import type { LmdbRoot, SubDb } from "./root.js";

const BEST_DATA = "best hash and posterior state root";

// TODO [ToDr] consider having a changeset for transactions,
// where we store all `insert ++ key ++ value` and `remove ++ key`
// in a single `Uint8Array` JAM-encoded. That could then
// be efficiently transferred between threads.
export class LmdbBlocks implements BlocksDb {
  readonly extrinsics: SubDb;
  readonly headers: SubDb;
  readonly postStateRoots: SubDb;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly root: LmdbRoot,
  ) {
    // NOTE [ToDr] Extrinsics are stored under header hash, not their hash. Revise if it's an issue.
    this.extrinsics = this.root.subDb("extrinsics");
    this.headers = this.root.subDb("headers");
    // NOTE [ToDr] We currently store all posterior state roots, however it's
    // most likely very redundant. We probably only need to store the posterior
    // state roots of recent blocks to be able to quickly resolve forks
    // OR we need a way to be able to traverse the blocks history forward
    // (i.e. know what next block(s) is).
    this.postStateRoots = this.root.subDb("postStateRoots");
  }

  async setPostStateRoot(hash: HeaderHash, postStateRoot: StateRootHash): Promise<void> {
    await this.postStateRoots.put(hash.raw, postStateRoot.raw);
  }

  getPostStateRoot(hash: HeaderHash): StateRootHash | null {
    const postStateRoot = this.postStateRoots.get(hash.raw);
    if (postStateRoot === undefined) {
      return null;
    }
    return Bytes.fromBlob(postStateRoot, HASH_SIZE).asOpaque();
  }

  async insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    const header = block.data.header.view().encoded();
    const extrinsic = block.data.extrinsic.view().encoded();
    await this.root.db.transaction(() => {
      this.headers.put(block.hash.raw, header.raw);
      this.extrinsics.put(block.hash.raw, extrinsic.raw);
    });
  }

  async setBestData(hash: HeaderHash, postState: StateRootHash): Promise<void> {
    await this.root.db.put(BEST_DATA, BytesBlob.blobFromParts(hash.raw, postState.raw).raw);
  }

  getBestData(): [HeaderHash, StateRootHash] {
    const bestData = this.root.db.get(BEST_DATA);
    if (bestData === undefined) {
      return [Bytes.zero(HASH_SIZE).asOpaque(), Bytes.zero(HASH_SIZE).asOpaque()];
    }

    return [
      Bytes.fromBlob(bestData.subarray(0, HASH_SIZE), HASH_SIZE).asOpaque(),
      Bytes.fromBlob(bestData.subarray(HASH_SIZE), HASH_SIZE).asOpaque(),
    ];
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    const data = this.headers.get(hash.raw);
    if (data === undefined) {
      return null;
    }

    return Decoder.decodeObject(Header.Codec.View, data, this.chainSpec);
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    const data = this.extrinsics.get(hash.raw);
    if (data === undefined) {
      return null;
    }
    return Decoder.decodeObject(Extrinsic.Codec.View, data, this.chainSpec);
  }
}
