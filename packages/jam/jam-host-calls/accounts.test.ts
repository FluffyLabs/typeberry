import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { Accounts } from "./accounts";

export class TestAccounts implements Accounts {
  public readonly preimages: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public readonly storage: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);

  lookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    if (serviceId === null) {
      return Promise.resolve(null);
    }
    const preImage = this.preimages.get(serviceId, hash);
    if (preImage === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(preImage);
  }

  read(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    if (serviceId === null) {
      return Promise.resolve(null);
    }
    const d = this.storage.get(serviceId, hash);
    if (d === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(d);
  }
}
