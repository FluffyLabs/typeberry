import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  type ServiceGas,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { PreimageHash } from "@typeberry/block/preimage";
import { Bytes } from "@typeberry/bytes";
import { FixedSizeArray, HashDictionary, asKnownSize } from "@typeberry/collections";
import { ED25519_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  Service,
  ServiceAccountInfo,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils";
import { OK, Result, ensure } from "@typeberry/utils";
import { PreimageStatusKind, RequestPreimageError, TRANSFER_MEMO_BYTES, TransferError } from "./partial-state";
import { PartialStateDb, PreimageUpdate } from "./partial-state-db";
import { PendingTransfer } from "./pending-transfer";

describe("PartialState.checkPreimageStatus", () => {
  it("should check preimage status from state", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();

    const status = partialState.checkPreimageStatus(preimageHash, tryAsU64(35));
    assert.deepStrictEqual(status, {
      status: PreimageStatusKind.Available,
      data: [0],
    });
  });

  it("should return preimage status when its in updated state", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();
    const length = tryAsU64(35);

    partialState.updatedState.preimages.push(
      PreimageUpdate.update(new LookupHistoryItem(preimageHash, tryAsU32(Number(length)), tryAsLookupHistorySlots([]))),
    );

    const status = partialState.checkPreimageStatus(preimageHash, length);
    assert.deepStrictEqual(status, {
      status: PreimageStatusKind.Requested,
    });
  });
});

describe("PartialState.requestPreimage", () => {
  it("should request a preimage and update service info", () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([]))),
    ]);
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.create({
        ...service.data.info,
        storageUtilisationBytes: tryAsU64(service.data.info.storageUtilisationBytes + 5n),
        storageUtilisationCount: tryAsU32(service.data.info.storageUtilisationCount + 1),
      }),
    );
  });

  it("should request a preimage and update service info", () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([]))),
    ]);
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.create({
        ...service.data.info,
        storageUtilisationBytes: tryAsU64(service.data.info.storageUtilisationBytes + 5n),
        storageUtilisationCount: tryAsU32(service.data.info.storageUtilisationCount + 1),
      }),
    );
  });

  it("should fail if preimage is already requested", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    const status2 = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status2, Result.error(RequestPreimageError.AlreadyRequested));
  });

  it("should fail if preimage is already available", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(35));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.AlreadyAvailable));
  });

  it("should fail if balance is insufficient", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(2n ** 64n - 1n));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.InsufficientFunds));
  });
});

describe("PartialState.forgetPreimage", () => {
  it("should error if preimage does not exist", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const hash = Bytes.fill(HASH_SIZE, 0x01).asOpaque();

    const result = partialState.forgetPreimage(hash, tryAsU64(42));
    assert.deepStrictEqual(result, Result.error(null));
  });

  it("should error if preimage is already forgotten", () => {
    const mockState = testState();
    const hash = Bytes.fill(HASH_SIZE, 0x02).asOpaque();
    const length = tryAsU64(42);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.forget(new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([]))),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.error(null));
  });

  it("should forget a requested preimage", () => {
    const mockState = testState();
    const hash = Bytes.fill(HASH_SIZE, 0x03).asOpaque();
    const length = tryAsU64(42);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.requestPreimage(hash, length);

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.forget(new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([]))),
    ]);
  });

  it("should forget an unavailable preimage if it is old enough", () => {
    const mockState = {
      ...testState(),
      timeslot: tryAsTimeSlot(100000),
    };

    const hash = Bytes.fill(HASH_SIZE, 0x04).asOpaque();
    const length = tryAsU64(42);
    const oldSlot = tryAsTimeSlot(0); // very old

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([oldSlot, oldSlot])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.forget(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([oldSlot, oldSlot])),
      ),
    ]);
  });

  it("should not forget an unavailable preimage if it is recent", () => {
    const mockState = {
      ...testState(),
      timeslot: tryAsTimeSlot(100),
    };

    const hash = Bytes.fill(HASH_SIZE, 0x05).asOpaque();
    const length = tryAsU64(42);
    const recentSlot = tryAsTimeSlot(90); // within expunge period

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([recentSlot])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));
  });

  it("should update lookup history for available preimage", () => {
    const mockState = {
      ...testState(),
      timeslot: tryAsTimeSlot(100),
    };

    const hash = Bytes.fill(HASH_SIZE, 0x06).asOpaque();
    const length = tryAsU64(42);
    const availableSlot = tryAsTimeSlot(80);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([availableSlot])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(
        new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([availableSlot, mockState.timeslot]),
        ),
      ),
    ]);
  });

  it("should update history for reavailable preimage if old", () => {
    const mockState = {
      ...testState(),
      timeslot: tryAsTimeSlot(100000),
    };

    const hash = Bytes.fill(HASH_SIZE, 0x07).asOpaque();
    const length = tryAsU64(42);
    const y = tryAsTimeSlot(0);
    const z = tryAsTimeSlot(70);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([z, mockState.timeslot])),
      ),
    ]);
  });

  it("should not update history for reavailable preimage if too recent", () => {
    const mockState = {
      ...testState(),
      timeslot: tryAsTimeSlot(100),
    };

    const hash = Bytes.fill(HASH_SIZE, 0x08).asOpaque();
    const length = tryAsU64(42);
    const y = tryAsTimeSlot(95); // too recent
    const z = tryAsTimeSlot(70);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.error(null));
  });
});

describe("PartialState.newService", () => {
  it("should create a new service and update balance + next service ID", () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const codeHash = Bytes.fill(HASH_SIZE, 0x11).asOpaque();
    const codeLength = tryAsU32(100);
    const accumulateMinGas = tryAsServiceGas(10n);
    const onTransferMinGas = tryAsServiceGas(20n);

    const items = tryAsU32(2); // 2 * 1 + 0
    const bytes = tryAsU64(81 + codeLength);
    const thresholdForNew = ServiceAccountInfo.calculateThresholdBalance(items, bytes);
    const expectedBalance = tryAsU64(service.data.info.balance - thresholdForNew);

    // when
    const result = partialState.newService(codeHash, codeLength, accumulateMinGas, onTransferMinGas);

    // then
    const expectedServiceId = tryAsServiceId(10);

    assert.deepStrictEqual(result, Result.ok(expectedServiceId));

    // Verify new service entry
    assert.deepStrictEqual(partialState.updatedState.newServices, [
      new Service(expectedServiceId, {
        info: ServiceAccountInfo.create({
          codeHash,
          balance: thresholdForNew,
          accumulateMinGas,
          onTransferMinGas,
          storageUtilisationBytes: bytes,
          storageUtilisationCount: items,
        }),
        preimages: HashDictionary.new(),
        lookupHistory: (() => {
          const map = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
          map.set(codeHash, [new LookupHistoryItem(codeHash, codeLength, tryAsLookupHistorySlots([]))]);
          return map;
        })(),
        storage: [],
      }),
    ]);

    // Verify source balance is reduced
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.create({
        ...service.data.info,
        balance: expectedBalance,
      }),
    );

    // Verify next service ID bumped
    assert.deepStrictEqual(partialState.getNextNewServiceId(), tryAsServiceId(4294966836));
  });

  it("should return an error if there are insufficient funds", () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const updatedService = new Service(service.id, {
      ...service.data,
      info: ServiceAccountInfo.create({
        ...service.data.info,
        // lower the balance a bit
        balance: tryAsU64(2 ** 32),
      }),
    });
    mockState.services.set(tryAsServiceId(0), updatedService);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const codeHash = Bytes.fill(HASH_SIZE, 0x12).asOpaque();
    // artificially large to exceed balance
    const codeLength = tryAsU32(2 ** 32 - 1);
    const accumulateMinGas = tryAsServiceGas(10n);
    const onTransferMinGas = tryAsServiceGas(20n);

    // when
    const result = partialState.newService(codeHash, codeLength, accumulateMinGas, onTransferMinGas);

    // then
    assert.deepStrictEqual(result, Result.error("insufficient funds"));

    // Verify no side effects
    assert.deepStrictEqual(partialState.updatedState.newServices, []);
    assert.strictEqual(partialState.updatedState.updatedServiceInfo, null);
  });
});

describe("PartialState.updateValidatorsData", () => {
  it("should update validators data", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    // when
    partialState.updateValidatorsData(
      asKnownSize([
        ValidatorData.create({
          bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, 0x1).asOpaque(),
          ed25519: Bytes.fill(ED25519_KEY_BYTES, 0x2).asOpaque(),
          bls: Bytes.fill(BLS_KEY_BYTES, 0x3).asOpaque(),
          metadata: Bytes.fill(VALIDATOR_META_BYTES, 0x4).asOpaque(),
        }),
      ]),
    );

    // then
    assert.deepStrictEqual(partialState.updatedState.validatorsData?.length, 1);
  });
});

describe("PartialState.checkpoint", () => {
  it("should checkpoint the updates", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();
    // put something into updated state
    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    // when
    partialState.checkpoint();

    // then
    assert.deepStrictEqual(partialState.getStateUpdates()[1], partialState.updatedState);
  });
});

describe("PartialState.upgradeService", () => {
  it("should update the service with new code hash and gas limits", () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const codeHash = Bytes.fill(HASH_SIZE, 0xcd).asOpaque();
    const gas = tryAsU64(1_000n);
    const allowance = tryAsU64(2_000n);

    // when
    partialState.upgradeService(codeHash, gas, allowance);

    // then
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.create({
        ...service.data.info,
        codeHash,
        accumulateMinGas: tryAsServiceGas(gas),
        onTransferMinGas: tryAsServiceGas(allowance),
      }),
    );
  });
});

describe("PartialState.updateAuthorizationQueue", () => {
  it("should update the authorization queue for a given core index", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const coreIndex = tryAsCoreIndex(0);
    const queue = FixedSizeArray.new(
      Array.from({ length: AUTHORIZATION_QUEUE_SIZE }, () => Bytes.fill(HASH_SIZE, 0xee)),
      AUTHORIZATION_QUEUE_SIZE,
    );

    // when
    partialState.updateAuthorizationQueue(coreIndex, queue);

    // then
    assert.deepStrictEqual(partialState.updatedState.authorizationQueues.get(coreIndex), queue);
  });
});

describe("PartialState.updatePrivilegedServices", () => {
  it("should update privileged services", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const manager = tryAsServiceId(1);
    const authorizer = tryAsServiceId(2);
    const validators = tryAsServiceId(3);
    const autoAccumulate = new Map<ServiceId, ServiceGas>([
      [tryAsServiceId(4), tryAsServiceGas(10n)],
      [tryAsServiceId(5), tryAsServiceGas(20n)],
    ]);

    // when
    partialState.updatePrivilegedServices(manager, authorizer, validators, autoAccumulate);

    // then
    assert.deepStrictEqual(partialState.updatedState.priviledgedServices, {
      manager,
      authorizer,
      validators,
      autoAccumulate,
    });
  });
});

describe("PartialState.transfer", () => {
  const testStateWithSecondService = () => {
    const mockState = testState();
    const maybeService = mockState.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);
    mockState.services.set(
      tryAsServiceId(1),
      new Service(tryAsServiceId(1), {
        info: ServiceAccountInfo.create({
          ...service.data.info,
          onTransferMinGas: tryAsServiceGas(1000),
        }),
        preimages: HashDictionary.new(),
        lookupHistory: HashDictionary.new(),
        storage: [],
      }),
    );
    return {
      mockState,
      service,
    };
  };
  it("should perform a successful transfer", () => {
    const { mockState, service } = testStateWithSecondService();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(500n);
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xaa);

    const newBalance = service.data.info.balance - amount;

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.ok(OK));
    assert.deepStrictEqual(partialState.updatedState.transfers, [
      PendingTransfer.create({
        source: tryAsServiceId(0),
        destination: destinationId,
        amount,
        memo,
        gas,
      }),
    ]);
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.create({
        ...service.data.info,
        balance: tryAsU64(newBalance),
      }),
    );
  });

  it("should return DestinationNotFound error if destination doesnt exist", () => {
    const { mockState } = testStateWithSecondService();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const amount = tryAsU64(100n);
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xbb);

    // when
    const result = partialState.transfer(tryAsServiceId(4), amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.DestinationNotFound));
  });

  it("should return GasTooLow error if gas is below destination's minimum", () => {
    const { mockState } = testStateWithSecondService();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(100n);
    const gas = tryAsServiceGas(999n); // too low
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xcc);

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.GasTooLow));
  });

  it("should return BalanceBelowThreshold error if balance would fall too low", () => {
    const { mockState } = testStateWithSecondService();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(9_999_999_999n); // dangerously high
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xdd);

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.BalanceBelowThreshold));
  });
});

describe("PartialState.yield", () => {
  it("should yield root", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0), tryAsServiceId(10));

    // when
    partialState.yield(Bytes.fill(HASH_SIZE, 0xef));

    // then
    assert.deepStrictEqual(partialState.updatedState.yieldedRoot, Bytes.fill(HASH_SIZE, 0xef));
  });
});
