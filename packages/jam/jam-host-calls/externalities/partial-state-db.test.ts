import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import { Bytes } from "@typeberry/bytes";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { ED25519_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { type Gas, tryAsGas } from "@typeberry/pvm-interpreter";
import {
  LookupHistoryItem,
  ServiceAccountInfo,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils";
import { OK, Result } from "@typeberry/utils";
import { PreimageStatusKind, RequestPreimageError } from "./partial-state";
import { PartialStateDb, PreimageUpdate } from "./partial-state-db";

describe("PartialState.checkPreimageStatus", () => {
  it("should check preimage status from state", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

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
    const service = mockState.services.get(tryAsServiceId(0));
    if (service === undefined) {
      throw new Error("No required service!");
    }
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([]))),
    ]);
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.fromCodec({
        ...service.data.info,
        storageUtilisationBytes: tryAsU64(service.data.info.storageUtilisationBytes + 5n),
        storageUtilisationCount: tryAsU32(service.data.info.storageUtilisationCount + 1),
      }),
    );
  });

  it("should request a preimage and update service info", () => {
    const mockState = testState();
    const service = mockState.services.get(tryAsServiceId(0));
    if (service === undefined) {
      throw new Error("No required service!");
    }
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(partialState.updatedState.preimages, [
      PreimageUpdate.update(new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([]))),
    ]);
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.fromCodec({
        ...service.data.info,
        storageUtilisationBytes: tryAsU64(service.data.info.storageUtilisationBytes + 5n),
        storageUtilisationCount: tryAsU32(service.data.info.storageUtilisationCount + 1),
      }),
    );
  });

  it("should fail if preimage is already requested", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    const status2 = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status2, Result.error(RequestPreimageError.AlreadyRequested));
  });

  it("should fail if preimage is already available", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(35));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.AlreadyAvailable));
  });

  it("should fail if balance is insufficient", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(2n ** 64n - 1n));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.InsufficientFunds));
  });
});

describe("PartialState.forgetPreimage", () => {
  it("should error if preimage does not exist", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const hash = Bytes.fill(HASH_SIZE, 0x01).asOpaque();

    const result = partialState.forgetPreimage(hash, tryAsU64(42));
    assert.deepStrictEqual(result, Result.error(null));
  });

  it("should error if preimage is already forgotten", () => {
    const mockState = testState();
    const hash = Bytes.fill(HASH_SIZE, 0x02).asOpaque();
    const length = tryAsU64(42);

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
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

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    partialState.updatedState.preimages.push(
      PreimageUpdate.update(
        new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z])),
      ),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.error(null));
  });
});

describe("PartialState.updateValidatorsData", () => {
  it("should update validators data", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

    // when
    partialState.updateValidatorsData(
      asKnownSize([
        ValidatorData.fromCodec({
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
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();
    // put something into updated state
    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    // when
    partialState.checkpoint();

    // then
    assert.deepStrictEqual(partialState.checkpointedState, partialState.updatedState);
  });
});

describe("PartialState.upgradeService", () => {
  it("should update the service with new code hash and gas limits", () => {
    const mockState = testState();
    const service = mockState.services.get(tryAsServiceId(0));
    if (service === undefined) {
      throw new Error("No required service!");
    }

    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

    const codeHash = Bytes.fill(HASH_SIZE, 0xcd).asOpaque();
    const gas = tryAsU64(1_000n);
    const allowance = tryAsU64(2_000n);

    // when
    partialState.upgradeService(codeHash, gas, allowance);

    // then
    assert.deepStrictEqual(
      partialState.updatedState.updatedServiceInfo,
      ServiceAccountInfo.fromCodec({
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
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

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
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

    const manager = tryAsServiceId(1);
    const authorizer = tryAsServiceId(2);
    const validators = tryAsServiceId(3);
    const autoAccumulate = new Map<ServiceId, Gas>([
      [tryAsServiceId(4), tryAsGas(10n)],
      [tryAsServiceId(5), tryAsGas(20n)],
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

describe("PartialState.yield", () => {
  it("should yield root", () => {
    const mockState = testState();
    const partialState = new PartialStateDb(mockState, tryAsServiceId(0));

    // when
    partialState.yield(Bytes.fill(HASH_SIZE, 0xef));

    // then
    assert.deepStrictEqual(partialState.updatedState.yieldedRoot, Bytes.fill(HASH_SIZE, 0xef));
  });
});
