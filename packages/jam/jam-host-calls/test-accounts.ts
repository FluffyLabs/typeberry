import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import { ServiceAccountInfo } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import type { AccountsInfo } from "./info.js";
import type { AccountsLookup } from "./lookup.js";
import type { AccountsRead } from "./read.js";
import type { AccountsWrite } from "./write.js";

export class TestAccounts implements AccountsLookup, AccountsRead, AccountsWrite, AccountsInfo {
  constructor(private readonly serviceId: ServiceId) {}
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

  lookup(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }
    const preImage = this.preimages.get(serviceId, hash);
    if (preImage === undefined) {
      return null;
    }
    return preImage;
  }

  read(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }
    const d = this.storage.get(serviceId, hash);
    if (d === undefined) {
      return null;
    }
    return d;
  }

  write(hash: Blake2bHash, data: BytesBlob | null): Result<OK, "full"> {
    if (this.isStorageFull()) {
      return Result.error("full");
    }

    if (data === null) {
      this.storage.delete(this.serviceId, hash);
    } else {
      this.storage.set(data, this.serviceId, hash);
    }

    return Result.ok(OK);
  }

  private isStorageFull(): boolean {
    const accountInfo = this.details.get(this.serviceId);
    if (accountInfo === undefined) {
      return false;
    }
    return (
      ServiceAccountInfo.calculateThresholdBalance(
        accountInfo.storageUtilisationCount,
        accountInfo.storageUtilisationBytes,
        accountInfo.gratisStorage,
      ) > accountInfo.balance
    );
  }

  readSnapshotLength(hash: Blake2bHash): number | null {
    const data = this.snapshotData.get(this.serviceId, hash);
    if (data === undefined) {
      return null;
    }
    return data?.length ?? null;
  }

  getServiceInfo(serviceId: ServiceId | null): ServiceAccountInfo | null {
    if (serviceId === null) {
      return null;
    }
    return this.details.get(serviceId) ?? null;
  }
}
