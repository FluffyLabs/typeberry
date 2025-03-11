import assert from "node:assert";
import { describe, it } from "node:test";
import { sumU32, sumU64, tryAsU32, tryAsU64, u32AsLittleEndian } from "./index";

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

describe("u32AsLittleEndian", () => {
  const createTestCase = (value: number, expectedResult: Uint8Array) => ({ value: tryAsU32(value), expectedResult });

  const testCases = [
    createTestCase(2 ** 32 - 1, new Uint8Array([0xff, 0xff, 0xff, 0xff])),
    createTestCase(2147483647, new Uint8Array([0xff, 0xff, 0xff, 0x7f])),
    createTestCase(5, new Uint8Array([5, 0, 0, 0])),
    createTestCase(0, new Uint8Array([0, 0, 0, 0])),
  ];

  for (const { value, expectedResult } of testCases) {
    it(`should return little endian representation of ${value}`, () => {
      const result = new Uint8Array(u32AsLittleEndian(value));

      assert.deepStrictEqual(result, expectedResult);
    });
  }
});

describe("tryAsU32", () => {
  it("should cast numbers", () => {
    const v = 1234;
    assert.deepStrictEqual(tryAsU32(v), 1234);
  });

  it("should cast bigint", () => {
    const v = 1234n;
    assert.deepStrictEqual(tryAsU32(v), 1234);
  });

  it("should throw if value exceeds u32", () => {
    const v = 2n ** 32n;
    assert.throws(() => tryAsU32(v), `input must have four-byte representation, got ${v}`);
  });
});
