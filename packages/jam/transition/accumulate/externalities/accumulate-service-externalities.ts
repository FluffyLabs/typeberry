import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsInfo } from "@typeberry/jam-host-calls/info.js";
import type { AccountsLookup } from "@typeberry/jam-host-calls/lookup.js";
import type { AccountsRead } from "@typeberry/jam-host-calls/read.js";
import type { AccountsWrite } from "@typeberry/jam-host-calls/write.js";
import { type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  ServiceAccountInfo,
  type State,
  StorageItem,
  type StorageKey,
  UpdateStorage,
  UpdateStorageKind,
} from "@typeberry/state";
import { assertNever } from "@typeberry/utils";

interface CurrentServiceNewBalanceProvider {
  getNewBalance(): U64 | null;
}

export class AccumulateServiceExternalities implements AccountsWrite, AccountsRead, AccountsInfo, AccountsLookup {
  private storage: HashDictionary<StorageKey, UpdateStorage> = HashDictionary.new();

  constructor(
    private readonly currentServiceId: ServiceId,
    private readonly state: Pick<State, "getService">,
    private readonly balanceProvider: CurrentServiceNewBalanceProvider,
  ) {}

  private getService(serviceId: ServiceId | null) {
    if (serviceId === null) {
      return null;
    }

    return this.state.getService(serviceId);
  }

  private createUpdateStorage(key: StorageKey, blob: BytesBlob | null) {
    if (blob === null) {
      return UpdateStorage.remove({ serviceId: this.currentServiceId, key });
    }

    const item = StorageItem.create({ hash: key.asOpaque(), blob });
    return UpdateStorage.set({ serviceId: this.currentServiceId, storage: item });
  }

  write(hash: Blake2bHash, data: BytesBlob | null): void {
    const update = this.createUpdateStorage(hash.asOpaque(), data);
    this.storage.set(hash.asOpaque(), update);
  }

  readSnapshotLength(hash: Blake2bHash): number | null {
    const service = this.getService(this.currentServiceId);
    return service?.getStorage(hash.asOpaque())?.length ?? null;
  }

  isStorageFull(): boolean {
    const maybeService = this.getService(this.currentServiceId);

    if (maybeService === null) {
      // TODO [MaSi]: log?
      return true;
    }
    const service = maybeService;
    const info = service.getInfo();

    let storageUtilisationBytes: bigint = info.storageUtilisationBytes;
    let storageUtilisationCount: number = info.storageUtilisationCount;

    for (const [key, update] of this.storage) {
      const oldValueLength = this.readSnapshotLength(key);

      if (oldValueLength !== null) {
        storageUtilisationCount--;
        storageUtilisationBytes = storageUtilisationBytes - BigInt(oldValueLength);
      }

      switch (update.action.kind) {
        case UpdateStorageKind.Remove:
          break;
        case UpdateStorageKind.Set: {
          const newItem = update.action.storage.blob;
          storageUtilisationCount++;
          storageUtilisationBytes += BigInt(newItem.length);
          break;
        }
        default:
          assertNever(update.action);
      }

      if (storageUtilisationCount < 0) {
        // TODO [MaSi]: log?
        storageUtilisationCount = 0;
      }

      if (storageUtilisationBytes < 0) {
        // TODO [MaSi]: log?
        storageUtilisationBytes = 0n;
      }
    }

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      tryAsU32(storageUtilisationCount),
      tryAsU64(storageUtilisationBytes),
    );

    const balance = this.balanceProvider.getNewBalance() ?? info.balance;

    return thresholdBalance > balance;
  }

  read(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null {
    if (this.currentServiceId === serviceId) {
      const item = this.storage.get(hash.asOpaque());
      if (item !== undefined) {
        switch (item.action.kind) {
          case UpdateStorageKind.Remove:
            return null;
          case UpdateStorageKind.Set:
            return item.action.storage.blob;
        }
      }
    }

    const service = this.getService(serviceId);
    return service?.getStorage(hash.asOpaque()) ?? null;
  }

  getInfo(serviceId: ServiceId | null): ServiceAccountInfo | null {
    const service = this.getService(serviceId);

    if (service === null) {
      return null;
    }

    return service.getInfo();
  }

  lookup(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null {
    const service = this.getService(serviceId);

    if (service === null) {
      return null;
    }

    return service.getPreimage(hash.asOpaque());
  }

  getUpdates() {
    return Array.from(this.storage.values());
  }
}
