import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsWrite } from "@typeberry/jam-host-calls/write.js";
import { Logger } from "@typeberry/logger";
import type { AccumulateServiceStorage, ServiceStorageManager } from "./accumulate-service-storage.js";

const logger = Logger.new(import.meta.filename, "accounts-write-externalities");

export class AccountsWriteExternalities implements AccountsWrite {
  constructor(private storageManager: ServiceStorageManager) {}

  private getStorage(serviceId: ServiceId): AccumulateServiceStorage | null {
    try {
      return this.storageManager.getStorage(serviceId);
    } catch {
      logger.error(`Failed to get storage for serviceId ${serviceId}`);
      return null;
    }
  }

  async write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void> {
    const storage = this.getStorage(serviceId);

    if (storage === null) {
      return;
    }

    storage.write(hash.asOpaque(), data);
  }

  async readSnapshotLength(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null> {
    const storage = this.getStorage(serviceId);

    if (storage === null) {
      return null;
    }

    return storage.readSnapshotLength(hash.asOpaque());
  }

  isStorageFull(serviceId: ServiceId): Promise<boolean> {
    const storage = this.getStorage(serviceId);

    if (storage === null) {
      return Promise.resolve(false);
    }

    return storage.isStorageFull();
  }
}
