import { BytesBlob } from "@typeberry/bytes";
import type { PreimageDb } from "@typeberry/database";
import { type OpaqueHash, WithHash } from "@typeberry/hash";
import lmdb from "lmdb";

// TODO [ToDr] Preimages should probably have an availability information.
// i.e. we might have something in the DB, but it should not be available
// in some block yet.
export class LmdbPreimages implements PreimageDb {
  readonly root: lmdb.RootDatabase<Uint8Array, lmdb.Key>;

  constructor(dbPath: string) {
    this.root = lmdb.open(dbPath, {
      compression: true,
      keyEncoding: "binary",
      encoding: "binary",
    });
  }

  get<T extends OpaqueHash>(hash: T): WithHash<T, BytesBlob> | null {
    const preimage = this.root.get(hash.raw);
    return preimage != null ? new WithHash(hash, BytesBlob.blobFrom(preimage)) : null;
  }

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void> {
    return this.root.transaction(() => {
      for (const d of data) {
        this.root.put(d.hash.raw, d.data.raw);
      }
    });
  }
}
