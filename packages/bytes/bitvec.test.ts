import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "./bitvec";
import { BytesBlob } from "./bytes";

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

  it("should sum two bit vecs if they have the same size", () => {
    const a = BitVec.empty(10);
    a.setBit(0, true);
    a.setBit(8, true);
    a.setBit(9, true);
    const b = BitVec.empty(10);
    b.setBit(0, true);
    b.setBit(1, true);
    b.setBit(9, true);
    const c = BitVec.empty(10);

    // when
    c.sumWith(a);
    b.sumWith(a);
    a.sumWith(b);

    const asBits = (x: BitVec) => `0b${Number(BytesBlob.blobFrom(x.raw)).toString(2)}`;

    // then
    assert.strictEqual(asBits(a), "0b1100000011");
    assert.strictEqual(asBits(b), "0b1100000011");
    assert.strictEqual(asBits(c), "0b100000011");
  });

  it("should given set indices", () => {
    const a = BitVec.empty(10);
    a.setBit(0, true);
    a.setBit(8, true);
    a.setBit(9, true);

    // when
    const indices = Array.from(a.indicesOfSetBits());

    // then
    assert.deepStrictEqual(indices, [0, 8, 9]);
  });
});
