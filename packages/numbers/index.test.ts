import assert from "node:assert";
import { describe, it } from "node:test";
import { i32AsLittleEndian, isI32, sumU32, sumU64, tryAsU32, tryAsU64 } from "./index";

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

describe("sumU64", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU64(tryAsU64(3), tryAsU64(5), tryAsU64(10));
    const res2 = sumU64(tryAsU64(2n ** 64n - 1n), tryAsU64(1n));
    const res3 = sumU64(tryAsU64(2n ** 64n - 1n), tryAsU64(2n ** 64n - 1n));
    const res4 = sumU64(tryAsU64(2n ** 64n - 1n), tryAsU64(2n ** 64n - 1n), tryAsU64(2n ** 64n - 1n));

    assert.deepStrictEqual(res1, { overflow: false, value: tryAsU64(18) });
    assert.deepStrictEqual(res2, { overflow: true, value: tryAsU64(0) });
    assert.deepStrictEqual(res3, { overflow: true, value: tryAsU64(2n ** 64n - 2n) });
    assert.deepStrictEqual(res4, { overflow: true, value: tryAsU64(2n ** 64n - 3n) });
  });
});

describe("isI32", () => {
  const creteTestCase = (value: number, expectedResult: boolean) => ({ value, expectedResult });

  const testCases = [
    creteTestCase(0, true),
    creteTestCase(-1, true),
    creteTestCase(1, true),
    creteTestCase(2147483648, false),
    creteTestCase(-2147483649, false),
    creteTestCase(3.14, false),
  ];

  for (const { value, expectedResult } of testCases) {
    it(`should correctly checks if ${value} is ${expectedResult ? "" : " not "} i32 number`, () => {
      const result = isI32(value);

      assert.strictEqual(result, expectedResult);
    });
  }
});

describe("i32AsLittleEndian", () => {
  const creteTestCase = (value: number, expectedResult: Uint8Array) => ({ value, expectedResult });

  const testCases = [
    creteTestCase(-1, new Uint8Array([0xff, 0xff, 0xff, 0xff])),
    creteTestCase(2147483647, new Uint8Array([0xff, 0xff, 0xff, 0x7f])),
    creteTestCase(-2147483648, new Uint8Array([0, 0, 0, 0x80])),
    creteTestCase(5, new Uint8Array([5, 0, 0, 0])),
    creteTestCase(0, new Uint8Array([0, 0, 0, 0])),
  ];

  for (const { value, expectedResult } of testCases) {
    it(`should return little endian representation of ${value}`, () => {
      const result = i32AsLittleEndian(value);

      assert.deepStrictEqual(result, expectedResult);
    });
  }
});
