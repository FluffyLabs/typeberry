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
import type { BlocksDb } from "@typeberry/database/blocks";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import type { LmdbRoot, SubDb } from "./root";

const BEST_DATA = "best hash and posterior state root";

// TODO [ToDr] consider having a changeset for transactions,
// where we store all `insert ++ key ++ value` and `remove ++ key`
// in a single `Uint8Array` JAM-encoded. That could then
// be efficiently transferred between threads.
export class LmdbBlocks implements BlocksDb {
  readonly extrinsics: SubDb;
  readonly headers: SubDb;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly root: LmdbRoot,
  ) {
    // NOTE [ToDr] Extrinsics are stored under header hash, not their hash. Revise if it's an issue.
    this.extrinsics = this.root.subDb("extrinsics");
    this.headers = this.root.subDb("headers");
    // NOTE [ToDr] Do we need a mapping from header hash to it's posterior root?
    // It's not really trivial to figure out what the next block is.
    // I suspect we will only need this to resolve forks, but in that case we can
    // backtrack using parent header hashes.
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
    this.root.db.put(BEST_DATA, BytesBlob.blobFromParts(hash.raw, postState.raw).raw);
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
