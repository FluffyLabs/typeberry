import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, type Service, ServiceAccountInfo, type StorageItem, type StorageKey } from "@typeberry/state";
import { AccountsWriteExternalities } from "./accounts-write-externalities.js";
import { ServiceStorageManager } from "./accumulate-service-storage.js";

describe("accounts-write-externalities", () => {
  const prepareService = (
    serviceId: ServiceId,
    initialStorage: HashDictionary<StorageKey, StorageItem> = HashDictionary.new(),
  ) => {
    const storageUtilisationBytes = Array.from(initialStorage.values()).reduce(
      (sum, item) => sum + (item?.blob.length ?? 0),
      0,
    );
    const storageUtilisationCount = Array.from(initialStorage.values()).length;
    return new InMemoryService(serviceId, {
      info: ServiceAccountInfo.create({
        balance: tryAsU64(2 ** 32),
        accumulateMinGas: tryAsServiceGas(1000),
        storageUtilisationBytes: tryAsU64(storageUtilisationBytes),
        storageUtilisationCount: tryAsU32(storageUtilisationCount),
        codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
        onTransferMinGas: tryAsServiceGas(1000),
      }),
      storage: initialStorage,
      preimages: HashDictionary.new(),
      lookupHistory: HashDictionary.new(),
    });
  };

  const prepareState = (correctServiceId: ServiceId, initialStorage?: HashDictionary<StorageKey, StorageItem>) => ({
    getService: (serviceId: ServiceId) => {
      if (serviceId === correctServiceId) {
        return prepareService(serviceId, initialStorage);
      }
      return null;
    },
  });

  function prepareStorage(
    serviceId: ServiceId,
    initialStorage?: HashDictionary<StorageKey, StorageItem>,
  ): ServiceStorageManager {
    const state = prepareState(serviceId, initialStorage);

    return new ServiceStorageManager(state);
  }

  describe("write", () => {
    it("should do nothing when service does not exist ", async () => {
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const storage = prepareStorage(tryAsServiceId(12));
      const accountsWriteExternalities = new AccountsWriteExternalities(storage);
      const data = BytesBlob.empty();

      await accountsWriteExternalities.write(serviceId, hash, data);

      assert.strictEqual(storage.getUpdates(serviceId).length, 0);
    });

    it("should correctly write to storage", async () => {
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const blob = BytesBlob.empty();
      const storage = prepareStorage(serviceId);
      const accountsWriteExternalities = new AccountsWriteExternalities(storage);

      assert.strictEqual(storage.getUpdates(serviceId).length, 0);

      await accountsWriteExternalities.write(serviceId, hash, blob);

      assert.strictEqual(storage.getUpdates(serviceId).length, 1);
    });
  });

  describe("readSnapshotLength", () => {
    it("should not be implemented yet", async () => {
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const storage = prepareStorage(serviceId);

      const accountsWriteExternalities = new AccountsWriteExternalities(storage);

      const result = await accountsWriteExternalities.readSnapshotLength(serviceId, hash);

      assert.strictEqual(result, null);
    });
  });

  describe("isStorageFull", () => {
    function prepareInfo(
      partialInfo: Pick<ServiceAccountInfo, "storageUtilisationCount" | "storageUtilisationBytes" | "balance">,
    ): ServiceAccountInfo {
      return {
        ...partialInfo,
        accumulateMinGas: tryAsServiceGas(0),
        codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
        onTransferMinGas: tryAsServiceGas(0),
      };
    }

    function prepareState(service: Service | null) {
      return { getService: () => service };
    }

    it("should return false if storage is not full", async () => {
      const serviceId = tryAsServiceId(0);
      const info = prepareInfo({
        balance: tryAsServiceGas(100000),
        storageUtilisationCount: tryAsU32(1),
        storageUtilisationBytes: tryAsU64(1),
      });
      const state = prepareState({ getInfo: () => info } as unknown as Service);
      const storage = new ServiceStorageManager(state);

      const accountsWriteExternalities = new AccountsWriteExternalities(storage);

      const result = await accountsWriteExternalities.isStorageFull(serviceId);

      assert.strictEqual(result, false);
    });

    it("should return true if storage is full", async () => {
      const serviceId = tryAsServiceId(0);
      const info = prepareInfo({
        balance: tryAsServiceGas(1),
        storageUtilisationCount: tryAsU32(1000),
        storageUtilisationBytes: tryAsU64(1000),
      });
      const state = prepareState({ getInfo: () => info } as unknown as Service);
      const storage = new ServiceStorageManager(state);

      const accountsWriteExternalities = new AccountsWriteExternalities(storage);

      const result = await accountsWriteExternalities.isStorageFull(serviceId);

      assert.strictEqual(result, true);
    });
  });
});
