import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  type Service,
  ServiceAccountInfo,
  type State,
  StorageItem,
  type StorageKey,
  UpdateStorage,
} from "@typeberry/state";

export class AccumulateServiceStorage {
  private serviceId: ServiceId;
  private storage: HashDictionary<StorageKey, StorageItem | null> = HashDictionary.new();
  private storageUpdates: UpdateStorage[] = [];

  private storageUtilisationBytes: U64;
  private storageUtilisationCount: U32;

  constructor(private service: Service) {
    this.serviceId = service.serviceId;
    const info = service.getInfo();
    this.storageUtilisationBytes = info.storageUtilisationBytes;
    this.storageUtilisationCount = info.storageUtilisationCount;
  }

  async write(hash: StorageKey, data: BytesBlob | null): Promise<void> {
    const existingItem = await this.read(hash);

    if (data === null && existingItem === null) {
      return; // No change, no update needed
    }

    if (existingItem !== null) {
      const newStorageUtilisationBytes = tryAsU64(this.storageUtilisationBytes - BigInt(existingItem.length));
      this.storageUtilisationBytes = newStorageUtilisationBytes < 0 ? tryAsU64(0n) : newStorageUtilisationBytes;
    }

    if (data === null) {
      const newStorageUtilisationCount = tryAsU32(this.storageUtilisationCount - 1);
      this.storageUtilisationCount = newStorageUtilisationCount < 0 ? tryAsU32(0) : newStorageUtilisationCount;
      this.storage.set(hash, null);
      this.storageUpdates.push(UpdateStorage.remove({ serviceId: this.serviceId, key: hash }));
      return;
    }

    const item = StorageItem.create({ blob: data, hash });
    this.storageUpdates.push(UpdateStorage.set({ serviceId: this.serviceId, storage: item }));
    this.storage.set(hash, item);
    this.storageUtilisationBytes = tryAsU64(this.storageUtilisationBytes + BigInt(data.length));
  }

  async readSnapshotLength(hash: StorageKey): Promise<number | null> {
    const maybeItem = await this.read(hash);
    return maybeItem?.length ?? null;
  }

  isStorageFull(): Promise<boolean> {
    const accountInfo = this.service.getInfo();

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      this.storageUtilisationCount,
      this.storageUtilisationBytes,
    );

    return Promise.resolve(thresholdBalance > accountInfo.balance);
  }

  async read(hash: StorageKey): Promise<BytesBlob | null> {
    return this.storage.get(hash)?.blob ?? this.service.getStorage(hash);
  }

  getUpdates(): UpdateStorage[] {
    return this.storageUpdates;
  }
}

export class ServiceStorageManager {
  private storageMap: Map<ServiceId, AccumulateServiceStorage> = new Map();

  constructor(private state: Pick<State, "getService">) {}

  getStorage(serviceId: ServiceId): AccumulateServiceStorage {
    const maybeStorage = this.storageMap.get(serviceId);

    if (maybeStorage !== undefined) {
      return maybeStorage;
    }

    const service = this.state.getService(serviceId) ?? null;

    if (service === null) {
      throw new Error(`Service with id ${serviceId} not found`);
    }

    const serviceStorage = new AccumulateServiceStorage(service);
    this.storageMap.set(serviceId, serviceStorage);
    return serviceStorage;
  }

  getUpdates(serviceId: ServiceId): UpdateStorage[] {
    return this.storageMap.get(serviceId)?.getUpdates() ?? [];
  }
}
