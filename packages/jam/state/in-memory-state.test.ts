import assert from "node:assert";
import { before, describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { asOpaqueType, deepEqual, OK, Result } from "@typeberry/utils";
import { InMemoryState, UpdateError } from "./in-memory-state.js";
import {
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "./service.js";
import { UpdatePreimage, UpdateServiceKind, UpdateStorage } from "./state-update.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("InMemoryState", () => {
  // backward-compatable account fields
  const accountComp = {
    gratisStorage: tryAsU64(1024),
    created: tryAsTimeSlot(10),
    lastAccumulation: tryAsTimeSlot(15),
    parentService: tryAsServiceId(1),
  };

  it("should not change anything when state udpate is empty", () => {
    const state = InMemoryState.empty(tinyChainSpec);
    const expectedState = InMemoryState.empty(tinyChainSpec);

    state.applyUpdate({});

    deepEqual(state, expectedState);
  });

  it("should create a new service when UpdateServiceKind.Create is applied", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    const result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) {
      assert.fail("Service not created!");
    }
    assert.deepEqual(service.data.info, accountInfo);
    assert.deepEqual(service.data.storage, new Map());
    assert.deepEqual(service.data.preimages, HashDictionary.new());
    assert.deepEqual(service.data.lookupHistory, HashDictionary.new());
  });

  it("should fail to create a service that already exists", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // First creation succeeds
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    // Second creation should fail
    result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.error(UpdateError.DuplicateService, "1 already exists!"));
  });

  it("should update storage of an existing service", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create service first
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));
    // Now set storage
    const key: StorageKey = asOpaqueType(Bytes.fill(1, HASH_SIZE));
    const value = BytesBlob.blobFromString("hello");
    const item = StorageItem.create({ key, value });
    const expectedItem = StorageItem.create({ key, value });

    result = state.applyUpdate({
      storage: [
        UpdateStorage.set({
          serviceId,
          storage: item,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) {
      assert.fail("Service not found after update.");
    }

    const actual = service.data.storage.get(key.toString());
    assert.deepEqual(actual, expectedItem);
  });

  it("should fail to update storage of non-existing service", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(42); // Not created
    const key = Bytes.zero(HASH_SIZE).asOpaque();
    const value = BytesBlob.blobFromString("data");
    const item = StorageItem.create({ key, value });

    const result = state.applyUpdate({
      storage: [
        UpdateStorage.set({
          serviceId,
          storage: item,
        }),
      ],
    });

    assert.deepEqual(
      result,
      Result.error(UpdateError.NoService, `Attempting to update storage of non-existing service: ${serviceId}`),
    );
  });

  it("should provide a preimage to an existing service", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create service first
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const blob = BytesBlob.blobFromString("my preimage");
    const hash = blake2b.hashBytes(blob).asOpaque();
    const preimage = PreimageItem.create({ hash, blob });
    const slot = tryAsTimeSlot(5);

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) {
      assert.fail("Service not found after preimage update.");
    }

    assert.deepEqual(service.data.preimages.get(hash), preimage);

    const history = service.data.lookupHistory.get(hash);
    assert.deepEqual(history?.length, 1);
    assert.deepEqual(history?.[0].length, tryAsU32(blob.length));
    assert.deepEqual(history?.[0].slots, tryAsLookupHistorySlots([slot]));
  });

  it("should provide a preimage with slot = null and not create lookup history", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create service first
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const blob = BytesBlob.blobFromString("my preimage");
    const hash = blake2b.hashBytes(blob).asOpaque();
    const preimage = PreimageItem.create({ hash, blob });

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot: null,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) {
      assert.fail("Service not found after preimage update.");
    }

    assert.deepEqual(service.data.preimages.get(hash), preimage);

    // Should not create lookup history
    assert.deepEqual(service.data.lookupHistory.get(hash), undefined);
  });

  it("should update or replace lookup history entry with UpdateOrAdd", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create the service
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    // Provide preimage first
    const blob = BytesBlob.blobFromString("lookup");
    const hash = blake2b.hashBytes(blob).asOpaque();
    const preimage = PreimageItem.create({ hash, blob });
    const slot1 = tryAsTimeSlot(1);

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot: slot1,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    // Now UpdateOrAdd with different slot but same length
    const slot2 = tryAsTimeSlot(2);
    const newItem = new LookupHistoryItem(hash, tryAsU32(blob.length), tryAsLookupHistorySlots([slot2]));

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.updateOrAdd({
          serviceId,
          lookupHistory: newItem,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) {
      assert.fail("Service not found after UpdateOrAdd.");
    }

    // Preimage should not be modified
    assert.deepEqual(service.data.preimages.get(hash), preimage);

    // Lookup history should be updated
    const history = service.data.lookupHistory.get(hash);
    assert.deepEqual(history?.length, 1);
    assert.deepEqual(history?.[0], newItem);
  });

  it("should fail to provide a preimage that already exists", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create the service
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const blob = BytesBlob.blobFromString("duplicate");
    const hash = blake2b.hashBytes(blob).asOpaque();
    const preimage = PreimageItem.create({ hash, blob });
    const slot = tryAsTimeSlot(1);

    // First application should succeed
    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    // Second application should fail
    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot,
        }),
      ],
    });

    assert.deepEqual(
      result,
      Result.error(UpdateError.PreimageExists, `Overwriting existing preimage at ${serviceId}: ${preimage}`),
    );
  });

  it("should remove a preimage and its lookup history entry", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    // Create the service
    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    // Add a preimage
    const blob = BytesBlob.blobFromString("removable");
    const hash = blake2b.hashBytes(blob).asOpaque();
    const length = tryAsU32(blob.length);
    const preimage = PreimageItem.create({ hash, blob });
    const slot = tryAsTimeSlot(3);

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const service = state.services.get(serviceId);
    if (service === undefined) assert.fail("Service not found after provide.");

    assert.deepEqual(service.data.preimages.get(hash), preimage);
    assert.deepEqual(service.data.lookupHistory.get(hash)?.length, 1);

    // Now remove the preimage
    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.remove({
          serviceId,
          hash,
          length,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    assert.deepEqual(service.data.preimages.has(hash), false);
    assert.deepEqual(service.data.lookupHistory.get(hash)?.length, 0);
  });

  it("should remove a specific lookup history entry by length", () => {
    const state = InMemoryState.empty(tinyChainSpec);

    const serviceId = tryAsServiceId(1);
    const accountInfo = ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(100),
      accumulateMinGas: tryAsServiceGas(10),
      onTransferMinGas: tryAsServiceGas(5),
      storageUtilisationBytes: tryAsU64(8),
      storageUtilisationCount: tryAsU32(3),
      ...accountComp,
    });

    let result = state.applyUpdate({
      servicesUpdates: [
        {
          serviceId,
          action: {
            kind: UpdateServiceKind.Create,
            account: accountInfo,
            lookupHistory: null,
          },
        },
      ],
    });
    assert.deepEqual(result, Result.ok(OK));

    // Add a preimage
    const blob = BytesBlob.blobFromString("some"); // length: 4
    const hash = blake2b.hashBytes(blob).asOpaque();
    const preimage = PreimageItem.create({ hash, blob });

    const slot1 = tryAsTimeSlot(1);
    const slot2 = tryAsTimeSlot(2);
    const length1 = tryAsU32(blob.length);
    const length2 = tryAsU32(blob.length + 1); // simulate different-length record
    const secondItem = new LookupHistoryItem(hash, length2, tryAsLookupHistorySlots([slot2]));

    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot: slot1,
        }),
        UpdatePreimage.updateOrAdd({
          serviceId,
          lookupHistory: secondItem,
        }),
      ],
    });

    const service = state.services.get(serviceId);
    if (service === undefined) assert.fail("Service not found");

    const historyBefore = service.data.lookupHistory.get(hash);
    assert.deepEqual(historyBefore?.length, 2);

    // Now remove only length1
    result = state.applyUpdate({
      preimages: [
        UpdatePreimage.remove({
          serviceId,
          hash,
          length: length1,
        }),
      ],
    });

    assert.deepEqual(result, Result.ok(OK));

    const historyAfter = service.data.lookupHistory.get(hash);
    assert.deepEqual(historyAfter?.length, 1);
    assert.deepEqual(historyAfter?.[0], secondItem);

    // Preimage itself is also removed
    assert.deepEqual(service.data.preimages.get(hash), undefined);
  });
});
