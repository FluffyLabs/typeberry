import { BytesBlob } from "@typeberry/bytes";
import type { PreimageDb } from "@typeberry/database";
import { type OpaqueHash, WithHash } from "@typeberry/hash";
import type { LmdbRoot, SubDb } from "./root.js";

// TODO [ToDr] Preimages should probably have an availability information.
// i.e. we might have something in the DB, but it should not be available
// in some block yet.
export class LmdbPreimages implements PreimageDb {
  preimages: SubDb;

  constructor(private readonly root: LmdbRoot) {
    this.preimages = this.root.subDb("preimages");
  }

  get<T extends OpaqueHash>(hash: T): WithHash<T, BytesBlob> | null {
    const preimage = this.preimages.get(hash.raw);
    return preimage !== undefined ? new WithHash(hash, BytesBlob.blobFrom(preimage)) : null;
  }

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void> {
    return this.preimages.transaction(() => {
      for (const d of data) {
        this.preimages.put(d.hash.raw, d.data.raw);
      }
    });
  }
}
