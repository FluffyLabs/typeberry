import type { WithHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import lmdb from "lmdb";
import type { PreimageDb } from "../database/preimage";

// TODO [ToDr] Preimages should probably have an availability information.
// i.e. we might have something in the DB, but it souhld not be available
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

  get<T extends OpaqueHash>(hash: T): BytesBlob | null {
    const preimage = this.root.get(hash.raw);
    return preimage ? BytesBlob.fromBlob(preimage) : null;
  }

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void> {
    return this.root.transaction(() => {
      for (const d of data) {
        this.root.put(d.hash.raw, d.data.buffer);
      }
    });
  }
}
