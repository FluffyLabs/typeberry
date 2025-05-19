import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { asKnownSize } from "@typeberry/collections";
import type { LookupHistorySlots } from "@typeberry/state";
import { PreimageStatusKind, slotsToPreimageStatus } from "./partial-state.js";

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
