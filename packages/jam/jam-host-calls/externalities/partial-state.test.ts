import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  type LookupHistorySlots,
  ServiceAccountInfo,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils";
import { Result } from "@typeberry/utils";
import { PreimageStatusKind, RequestPreimageError, slotsToPreimageStatus } from "./partial-state";
import { PartialStateDb } from "./partial-state-db";

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

    partialState.updatedState.lookupHistory.push(
      new LookupHistoryItem(preimageHash, tryAsU32(Number(length)), tryAsLookupHistorySlots([])),
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
    assert.deepStrictEqual(status, Result.ok(null));

    assert.deepStrictEqual(partialState.updatedState.lookupHistory, [
      new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([])),
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
    assert.deepStrictEqual(status, Result.ok(null));

    assert.deepStrictEqual(partialState.updatedState.lookupHistory, [
      new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([])),
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
    assert.deepStrictEqual(status, Result.ok(null));

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

describe("slotsToPreimageStatus", () => {
  it("returns Requested when no slots are given", () => {
    const slots: LookupHistorySlots = asKnownSize([]);
    const result = slotsToPreimageStatus(slots);
    assert.deepEqual(result, {
      status: PreimageStatusKind.Requested,
    });
  });

  it("returns Available when one slot is given", () => {
    const slots: LookupHistorySlots = asKnownSize([tryAsTimeSlot(42)]);
    const result = slotsToPreimageStatus(slots);
    assert.deepEqual(result, {
      status: PreimageStatusKind.Available,
      data: slots,
    });
  });

  it("returns Unavailable when two slots are given", () => {
    const slots: LookupHistorySlots = asKnownSize([1, 2].map((x) => tryAsTimeSlot(x)));
    const result = slotsToPreimageStatus(slots);
    assert.deepEqual(result, {
      status: PreimageStatusKind.Unavailable,
      data: slots,
    });
  });

  it("returns Reavailable when three slots are given", () => {
    const slots: LookupHistorySlots = asKnownSize([10, 20, 30].map((x) => tryAsTimeSlot(x)));
    const result = slotsToPreimageStatus(slots);
    assert.deepEqual(result, {
      status: PreimageStatusKind.Reavailable,
      data: slots,
    });
  });

  it("throws an error when more than three slots are given", () => {
    const slots: LookupHistorySlots = asKnownSize([10, 20, 30, 40].map((x) => tryAsTimeSlot(x)));
    assert.throws(() => slotsToPreimageStatus(slots), {
      message: "Invalid slots length: 4",
    });
  });
});
