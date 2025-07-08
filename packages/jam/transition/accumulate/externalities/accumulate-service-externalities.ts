import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { UpdatedCurrentService } from "@typeberry/jam-host-calls/externalities/partial-state-db.js";
import type { AccountsInfo } from "@typeberry/jam-host-calls/info.js";
import type { AccountsLookup } from "@typeberry/jam-host-calls/lookup.js";
import type { AccountsRead } from "@typeberry/jam-host-calls/read.js";
import type { AccountsWrite } from "@typeberry/jam-host-calls/write.js";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  type Service,
  ServiceAccountInfo,
  type State,
  StorageItem,
  type StorageKey,
  UpdateStorage,
  UpdateStorageKind,
} from "@typeberry/state";
import { assertNever, check } from "@typeberry/utils";

export class AccumulateServiceExternalities implements AccountsWrite, AccountsRead, AccountsInfo, AccountsLookup {
  private storage: HashDictionary<StorageKey, UpdateStorage> = HashDictionary.new();

  constructor(
    private readonly currentServiceId: ServiceId,
    private readonly state: Pick<State, "getService">,
    private readonly updatedServiceState: UpdatedCurrentService,
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

  private getCurrentServiceInfo(service: Service) {
    return this.updatedServiceState.getCurrentServiceInfo() ?? service.getInfo();
  }

  isStorageFull(): boolean {
    const maybeService = this.getService(this.currentServiceId);

    if (maybeService === null) {
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

      check(storageUtilisationCount >= 0, "storageUtilisationCount has to be a positive number");
      check(storageUtilisationBytes >= 0, "storageUtilisationBytes has to be a positive number");
    }

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      tryAsU32(storageUtilisationCount),
      tryAsU64(storageUtilisationBytes),
    );

    const balance = this.getCurrentServiceInfo(service).balance;

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
    if (this.currentServiceId === serviceId) {
      return this.updatedServiceState.getCurrentServiceInfo();
    }

    const service = this.getService(serviceId);

    if (service === null) {
      return null;
    }

    return service.getInfo();
  }

  lookup(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }

    const maybeUpdatedPreimage = this.updatedServiceState.getUpdatedServicePreimage(serviceId, hash.asOpaque());

    if (maybeUpdatedPreimage !== null) {
      return maybeUpdatedPreimage;
    }

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
