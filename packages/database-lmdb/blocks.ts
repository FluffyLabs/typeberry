import {
  type BlockView,
  Extrinsic,
  type ExtrinsicView,
  Header,
  type HeaderHash,
  type HeaderView,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database/blocks";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import lmdb from "lmdb";

const BEST_BLOCK_KEY = "best block";

// TODO [ToDr] consider having a changeset for transactions,
// where we store all `insert ++ key ++ value` and `remove ++ key`
// in a single `Uint8Array` JAM-encoded. That could then
// be efficiently transferred between threads.
export class LmdbBlocks implements BlocksDb {
  readonly root: lmdb.RootDatabase<Uint8Array, lmdb.Key>;
  readonly extrinsics: lmdb.Database<Uint8Array, lmdb.Key>;
  readonly headers: lmdb.Database<Uint8Array, lmdb.Key>;

  constructor(
    private readonly chainSpec: ChainSpec,
    dbPath: string,
  ) {
    this.root = lmdb.open(dbPath, {
      compression: true,
      keyEncoding: "binary",
      encoding: "binary",
    });
    // TODO [ToDr] Extrinsics are stored under header hash, not their hash. Revise if it's an issue.
    this.extrinsics = this.root.openDB({ name: "extrinsics" });
    this.headers = this.root.openDB({ name: "headers" });
  }

  async insertBlock(block: WithHash<HeaderHash, BlockView>): Promise<void> {
    // TODO [ToDr] This is currently inefficient, we need a way to figure
    // out boundaries of fields within the view type, to just get
    // subarrays of the underlying BlockView.
    // TODO [ToDr] we could use a single Uint8Array to perform the encoding instead of doing allocs.
    const header = Encoder.encodeObject(Header.Codec, block.data.header(), this.chainSpec);
    const extrinsic = Encoder.encodeObject(Extrinsic.Codec, block.data.extrinsic(), this.chainSpec);
    const a = this.headers.put(block.hash.raw, header.raw);
    const b = this.extrinsics.put(block.hash.raw, extrinsic.raw);
    await Promise.all([a, b]);
    return;
  }

  async setBestHeaderHash(hash: HeaderHash): Promise<void> {
    await this.root.put(BEST_BLOCK_KEY, hash.raw);
  }

  getBestHeaderHash(): HeaderHash {
    const data = this.root.get(BEST_BLOCK_KEY);
    return (data ? Bytes.fromBlob(data, HASH_SIZE) : Bytes.zero(HASH_SIZE)) as HeaderHash;
  }

  getHeader(hash: HeaderHash): HeaderView | null {
    const data = this.headers.get(hash.raw);
    if (!data) {
      return null;
    }

    return Header.Codec.View.fromBytesBlob(BytesBlob.blobFrom(data), this.chainSpec) as HeaderView;
  }

  getExtrinsic(hash: HeaderHash): ExtrinsicView | null {
    const data = this.extrinsics.get(hash.raw);
    if (!data) {
      return null;
    }
    return Extrinsic.Codec.View.fromBytesBlob(BytesBlob.blobFrom(data), this.chainSpec) as ExtrinsicView;
  }
}
