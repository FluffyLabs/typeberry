import { WithHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";

/**
 * Interface for preimage database.
 */
export interface PreimageDb {
  /** Retrieve a preimage for given hash. */
  get<T extends OpaqueHash>(hash: T): WithHash<T, BytesBlob> | null;
  /** Asynchronously write one or more preimages to the database. */
  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void>;
}

/** An in-memory implementation of the preimage database. */
export class InMemoryPreimages implements PreimageDb {
  private readonly db = new HashDictionary<OpaqueHash, BytesBlob>();

  get<T extends OpaqueHash>(hash: T): WithHash<T, BytesBlob> | null {
    const data = this.db.get(hash);
    return data ? new WithHash(hash, data) : null;
  }

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void> {
    for (const d of data) {
      this.db.set(d.hash, d.data);
    }
    return Promise.resolve();
  }
}
