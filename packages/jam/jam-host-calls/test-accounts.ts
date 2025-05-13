import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { ServiceAccountInfo } from "@typeberry/state";
import type { AccountsInfo } from "./info";
import type { AccountsLookup } from "./lookup";
import type { AccountsRead } from "./read";
import type { AccountsWrite } from "./write";

export class TestAccounts implements AccountsLookup, AccountsRead, AccountsWrite, AccountsInfo {
  public readonly preimages: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public readonly storage: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public readonly snapshotData: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public readonly details = new Map<ServiceId, ServiceAccountInfo>();

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

  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void> {
    if (data === null) {
      this.storage.delete(serviceId, hash);
    } else {
      this.storage.set(data, serviceId, hash);
    }

    return Promise.resolve();
  }

  readSnapshotLength(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null> {
    const data = this.snapshotData.get(serviceId, hash);
    if (data === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(data?.length ?? null);
  }

  isStorageFull(serviceId: ServiceId): Promise<boolean> {
    const accountInfo = this.details.get(serviceId);
    if (accountInfo === undefined) {
      return Promise.resolve(false);
    }
    return Promise.resolve(accountInfo.thresholdBalance() > accountInfo.balance);
  }

  getInfo(serviceId: ServiceId | null): Promise<ServiceAccountInfo | null> {
    if (serviceId === null) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.details.get(serviceId) ?? null);
  }
}
