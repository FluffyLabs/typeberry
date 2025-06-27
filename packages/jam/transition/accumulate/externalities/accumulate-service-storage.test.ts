import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, ServiceAccountInfo, StorageItem, type StorageKey, UpdateStorage } from "@typeberry/state";
import { AccumulateServiceStorage, ServiceStorageManager } from "./accumulate-service-storage.js";

describe("AccumulateServiceStorage", () => {
  const prepareStorage = (
    serviceId: ServiceId,
    initialStorage: HashDictionary<StorageKey, StorageItem> = HashDictionary.new(),
  ) => {
    const storageUtilisationBytes = Array.from(initialStorage.values()).reduce(
      (sum, item) => sum + (item?.blob.length ?? 0),
      0,
    );
    const storageUtilisationCount = Array.from(initialStorage.values()).length;
    const service = new InMemoryService(serviceId, {
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

    return new AccumulateServiceStorage(service);
  };

  const prepareWriteStorageUpdate = (serviceId: ServiceId, hash: StorageKey, blob: BytesBlob) => {
    return UpdateStorage.set({ serviceId, storage: StorageItem.create({ blob, hash }) });
  };

  const prepareRemoveStorageUpdate = (serviceId: ServiceId, key: StorageKey) => {
    return UpdateStorage.remove({ serviceId, key });
  };

  it("should return the written data as a state update", async () => {
    const serviceId = tryAsServiceId(1);
    const storage = prepareStorage(serviceId);
    const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
    const data = BytesBlob.empty();
    const expectedStateUpdate = prepareWriteStorageUpdate(serviceId, hash, data);

    await storage.write(hash, data);
    const updates = storage.getUpdates();

    assert.deepStrictEqual(updates, [expectedStateUpdate]);
  });

  it("should not add state update if the item does not exist", async () => {
    const serviceId = tryAsServiceId(1);
    const storage = prepareStorage(serviceId);
    const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
    const data: BytesBlob | null = null;

    await storage.write(hash, data);
    const updates = storage.getUpdates();

    assert.deepStrictEqual(updates, []);
  });

  it("should return the removed data as a state update", async () => {
    const serviceId = tryAsServiceId(1);
    const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
    const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
    initialStorage.set(hash, StorageItem.create({ blob: BytesBlob.empty(), hash }));
    const storage = prepareStorage(serviceId, initialStorage);
    const data: BytesBlob | null = null;
    const expectedStateUpdate = prepareRemoveStorageUpdate(serviceId, hash);

    await storage.write(hash, data);
    const updates = storage.getUpdates();

    assert.deepStrictEqual(updates, [expectedStateUpdate]);
  });

  it("should return the written data when reading", async () => {
    const serviceId = tryAsServiceId(1);
    const storage = prepareStorage(serviceId);
    const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
    const data = BytesBlob.empty();

    const emptyResult = await storage.read(hash);
    await storage.write(hash, data);
    const result = await storage.read(hash);

    assert.strictEqual(emptyResult, null);
    assert.deepStrictEqual(result, data);
  });
});

describe("ServiceStorageManager", () => {
  const prepareState = (correctServiceId: ServiceId) => ({
    getService: (serviceId: ServiceId) => {
      if (serviceId === correctServiceId) {
        return new InMemoryService(serviceId, {
          info: ServiceAccountInfo.create({
            balance: tryAsU64(2 ** 32),
            accumulateMinGas: tryAsServiceGas(1000),
            storageUtilisationBytes: tryAsU64(0),
            storageUtilisationCount: tryAsU32(0),
            codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
            onTransferMinGas: tryAsServiceGas(1000),
          }),
          storage: HashDictionary.new(),
          preimages: HashDictionary.new(),
          lookupHistory: HashDictionary.new(),
        });
      }

      return null;
    },
  });

  it("should return a storage instance for a valid serviceId", () => {
    const state = prepareState(tryAsServiceId(1));
    const storageManager = new ServiceStorageManager(state);

    const storage = storageManager.getStorage(tryAsServiceId(1));

    assert.ok(storage instanceof AccumulateServiceStorage);
  });

  it("should return a correct list of storage updates", async () => {
    const state = prepareState(tryAsServiceId(1));
    const storageManager = new ServiceStorageManager(state);

    const storage = storageManager.getStorage(tryAsServiceId(1));
    const emptyUpdates = storageManager.getUpdates(tryAsServiceId(1));

    assert.strictEqual(emptyUpdates.length, 0);

    await storage.write(Bytes.fill(HASH_SIZE, 1).asOpaque(), Bytes.fill(10, 1));

    const updates = storageManager.getUpdates(tryAsServiceId(1));
    assert.strictEqual(updates.length, 1);
  });
});
