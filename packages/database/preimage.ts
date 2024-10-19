import {WithHash} from "@typeberry/block";
import {BytesBlob} from "@typeberry/bytes";
import {HashDictionary} from "@typeberry/collections"
import {OpaqueHash} from "@typeberry/hash";

export interface PreimageDb {
  get<T extends OpaqueHash>(hash: T): BytesBlob | null;

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void>;
}

export class InMemoryPreimageDb implements PreimageDb {
  private readonly db = new HashDictionary<OpaqueHash, BytesBlob>;

  get<T extends OpaqueHash>(hash: T): BytesBlob | null {
    return this.db.get(hash) ?? null;
  }

  set<T extends OpaqueHash>(...data: WithHash<T, BytesBlob>[]): Promise<void> {
    for (const d of data) {
      this.db.set(d.hash, d.data);
    }
    return Promise.resolve();
  }
}
