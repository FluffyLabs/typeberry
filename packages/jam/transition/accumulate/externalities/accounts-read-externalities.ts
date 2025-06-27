import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsRead } from "@typeberry/jam-host-calls/read.js";
import { Logger } from "@typeberry/logger";
import type { AccumulateServiceStorage, ServiceStorageManager } from "./accumulate-service-storage.js";

const logger = Logger.new(import.meta.filename, "accounts-read-externalities");

export class AccountsReadExternalities implements AccountsRead {
  constructor(private storageManager: ServiceStorageManager) {}

  private getStorage(serviceId: ServiceId): AccumulateServiceStorage | null {
    try {
      return this.storageManager.getStorage(serviceId);
    } catch {
      logger.error(`Failed to get storage for serviceId ${serviceId}`);
      return null;
    }
  }

  async read(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    if (serviceId === null) {
      return null;
    }
    const storage = this.getStorage(serviceId);

    if (storage === null) {
      return Promise.resolve(null);
    }

    return storage.read(hash.asOpaque());
  }
}
