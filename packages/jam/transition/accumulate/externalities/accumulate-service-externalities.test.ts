import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { UpdatedCurrentService } from "@typeberry/jam-host-calls/externalities/partial-state-db.js";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryService,
  InMemoryState,
  PreimageItem,
  ServiceAccountInfo,
  StorageItem,
  type StorageKey,
} from "@typeberry/state";
import { AccumulateServiceExternalities } from "./accumulate-service-externalities.js";

describe("AccumulateServiceExternalities", () => {
  const prepareState = (serviceArray: InMemoryService[] = []) => {
    const services = new Map<ServiceId, InMemoryService>();

    for (const service of serviceArray) {
      services.set(service.serviceId, service);
    }

    const state = InMemoryState.empty(tinyChainSpec);
    state.services = services;
    return state;
  };

  const prepareService = (
    serviceId: ServiceId,
    {
      storage,
      preimages,
      info,
    }: {
      storage?: HashDictionary<StorageKey, StorageItem>;
      preimages?: HashDictionary<PreimageHash, PreimageItem>;
      info?: Partial<ServiceAccountInfo>;
    } = {},
  ) => {
    const initialStorage = storage ?? HashDictionary.new();
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
        ...info,
      }),
      storage: initialStorage,
      preimages: preimages ?? HashDictionary.new(),
      lookupHistory: HashDictionary.new(),
    });
  };

  const preparePreimages = (preimageArray: [PreimageHash, BytesBlob][]) => {
    const preimages: HashDictionary<PreimageHash, PreimageItem> = HashDictionary.new();

    for (const [hash, blob] of preimageArray) {
      const item = PreimageItem.create({ hash, blob });
      preimages.set(hash, item);
    }

    return preimages;
  };

  const prepareUpdatedService = (partialInfo: Partial<ServiceAccountInfo> = {}): UpdatedCurrentService => ({
    getCurrentServiceInfo: () => {
      return ServiceAccountInfo.create({
        balance: tryAsU64(0),
        codeHash: Bytes.fill(HASH_SIZE, 1).asOpaque(),
        accumulateMinGas: tryAsServiceGas(0),
        onTransferMinGas: tryAsServiceGas(0),
        storageUtilisationBytes: tryAsU64(0),
        storageUtilisationCount: tryAsU32(0),
        ...partialInfo,
      });
    },

    getUpdatedServicePreimage: (_serviceId: ServiceId, _hash: PreimageHash) => {
      return null;
    },
  });

  describe("getInfo", () => {
    it("should return null when serviceId is null", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const state = prepareState();
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const serviceInfo = accumulateServiceExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return null when serviceId is incorrect", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(5);
      const state = prepareState();
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const serviceInfo = accumulateServiceExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return correct service info", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(5);
      const service = prepareService(serviceId);
      const state = prepareState([service]);
      const expectedServiceInfo = service.getInfo();

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const serviceInfo = accumulateServiceExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });
  });

  describe("lookup", () => {
    it("should return null when serviceId is null", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState();
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when service does not exist", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState();
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when preimage does not exists", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(0);
      const requestedHash = Bytes.fill(HASH_SIZE, 1);
      const otherHash = Bytes.fill(HASH_SIZE, 2).asOpaque();
      const preimages = preparePreimages([[otherHash, BytesBlob.empty()]]);
      const service = prepareService(serviceId, { preimages });
      const state = prepareState([service]);
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, requestedHash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return return a correct preimage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(0);
      const expectedResult = BytesBlob.empty();
      const requestedHash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const preimages = preparePreimages([[requestedHash, expectedResult]]);
      const service = prepareService(serviceId, { preimages });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, requestedHash);

      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe("read / write", () => {
    it("should return null when serviceId is null ", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState();

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should return null when service does not exist ", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState();
      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should correctly read from storage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
      const blob = BytesBlob.empty();
      initialStorage.set(hash, StorageItem.create({ hash, blob }));
      const service = prepareService(serviceId, { storage: initialStorage });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, blob);
    });

    it("should correctly write to storage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const blob = BytesBlob.empty();
      const state = prepareState();
      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      assert.strictEqual(accumulateServiceExternalities.getUpdates().length, 0);

      accumulateServiceExternalities.write(hash, blob);

      assert.strictEqual(accumulateServiceExternalities.getUpdates().length, 1);
    });

    it("should return new value if there was write", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
      const blob = BytesBlob.empty();
      const newBlob = BytesBlob.parseBlob("0x11111111");
      initialStorage.set(hash, StorageItem.create({ hash, blob }));
      const service = prepareService(currentServiceId, { storage: initialStorage });
      const state = prepareState([service]);
      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      accumulateServiceExternalities.write(hash, newBlob);

      assert.strictEqual(accumulateServiceExternalities.getUpdates().length, 1);

      const result = accumulateServiceExternalities.read(currentServiceId, hash);

      assert.deepStrictEqual(result, newBlob);
    });
  });

  describe("readSnapshotLength", () => {
    it("should correctly read from storage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
      const blob = BytesBlob.empty();
      initialStorage.set(hash, StorageItem.create({ hash, blob }));
      const service = prepareService(serviceId, { storage: initialStorage });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, blob);
    });

    it("should return snapshot length even if a new value if was written", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<StorageKey, StorageItem>();
      const blob = BytesBlob.empty();
      const newBlob = BytesBlob.parseBlob("0x11111111");
      initialStorage.set(hash, StorageItem.create({ hash, blob }));
      const service = prepareService(currentServiceId, { storage: initialStorage });
      const state = prepareState([service]);
      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService(),
      );

      accumulateServiceExternalities.write(hash, newBlob);
      const result = accumulateServiceExternalities.readSnapshotLength(hash);

      assert.deepStrictEqual(result, blob.length);
    });
  });

  describe("isStorageFull", () => {
    it("should return false if storage is not full", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const service = prepareService(currentServiceId, {
        info: {
          balance: tryAsU64(100000),
          storageUtilisationCount: tryAsU32(1),
          storageUtilisationBytes: tryAsU64(1),
        },
      });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService({ balance: tryAsU64(100000) }),
      );

      const result = accumulateServiceExternalities.isStorageFull();

      assert.strictEqual(result, false);
    });

    it("should return true if storage is full", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const service = prepareService(currentServiceId, {
        info: {
          balance: tryAsServiceGas(1),
          storageUtilisationCount: tryAsU32(1000),
          storageUtilisationBytes: tryAsU64(1000),
        },
      });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateServiceExternalities(
        currentServiceId,
        state,
        prepareUpdatedService({ balance: tryAsU64(1) }),
      );

      const result = accumulateServiceExternalities.isStorageFull();

      assert.strictEqual(result, true);
    });
  });
});
