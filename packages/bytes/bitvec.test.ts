import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "./bitvec";

describe("BitVec", () => {
  it("should set and read bytes", () => {
    const bits = BitVec.empty(10);

    bits.setBit(0, true);
    bits.setBit(8, true);
    bits.setBit(9, true);

    assert.ok(bits.isSet(0));
    assert.ok(bits.isSet(9));
    assert.ok(bits.isSet(8));

    for (let i = 1; i < 8; i += 1) {
      assert.ok(!bits.isSet(i));
    }
  });
});
