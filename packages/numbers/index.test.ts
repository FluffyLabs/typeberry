import assert from "node:assert";
import { describe, it } from "node:test";
import { i32AsLittleEndian, sumU32, tryAsU32 } from "./index";

describe("sumU32", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU32(tryAsU32(3), tryAsU32(5), tryAsU32(10));
    const res2 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(1));
    const res3 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1));
    const res4 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1));

    assert.deepStrictEqual(res1, { overflow: false, value: tryAsU32(18) });
    assert.deepStrictEqual(res2, { overflow: true, value: tryAsU32(0) });
    assert.deepStrictEqual(res3, { overflow: true, value: tryAsU32(2 ** 32 - 2) });
    assert.deepStrictEqual(res4, { overflow: true, value: tryAsU32(2 ** 32 - 3) });
  });
});

describe("i32AsLittleEndian", () => {
  it("should transform bunch of numbers into little-endian representation", () => {
    const numbers: number[] = [-1, 2 ** 32 - 1, 5, 0];

    const expectedResult = [
      new Uint8Array([0xff, 0xff, 0xff, 0xff]),
      new Uint8Array([0xff, 0xff, 0xff, 0xff]),
      new Uint8Array([0x5, 0, 0, 0]),
      new Uint8Array([0, 0, 0, 0]),
    ];

    assert.deepStrictEqual(numbers.map(i32AsLittleEndian), expectedResult);
  });
});
