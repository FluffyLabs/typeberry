import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, ServiceAccountInfo, StorageItem, type StorageKey } from "@typeberry/state";
import { AccountsReadExternalities } from "./accounts-read-externalities.js";
import { ServiceStorageManager } from "./accumulate-service-storage.js";

describe("accounts-read-externalities", () => {
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

  describe("read", () => {
    it("should return null when serviceId is null ", async () => {
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1);
      const storage = prepareStorage(tryAsServiceId(0));
      const accountsReadExternalities = new AccountsReadExternalities(storage);

      const result = await accountsReadExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should return null when service does not exist ", async () => {
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const storage = prepareStorage(tryAsServiceId(12));
      const accountsReadExternalities = new AccountsReadExternalities(storage);

      const result = await accountsReadExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should correctly read from storage", async () => {
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
      const blob = BytesBlob.empty();
      initialStorage.set(hash, StorageItem.create({ hash, blob }));
      const storage = prepareStorage(serviceId, initialStorage);
      const accountsReadExternalities = new AccountsReadExternalities(storage);

      const result = await accountsReadExternalities.read(serviceId, hash);

      assert.strictEqual(result, blob);
    });
  });
});
