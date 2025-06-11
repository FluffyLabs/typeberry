import assert from "node:assert";
import { describe, it } from "node:test";

import { clz64, countBits32, countBits64, ctz32, ctz64 } from "./bit-utils.js";

describe("bit-utils", () => {
  describe("countBits32", () => {
    it("should correctly count 1 in number", () => {
      const value = 1;
      const expectedResult = 1;

      const result = countBits32(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count 1 in number (max value)", () => {
      const value = 0xffffffff;
      const expectedResult = 32;

      const result = countBits32(value);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("countBits64", () => {
    it("should correctly count 1 in bigint", () => {
      const value = 1n;
      const expectedResult = 1;

      const result = countBits64(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count 1 in bigint (max value)", () => {
      const value = 0xffffffff_ffffffffn;
      const expectedResult = 64;

      const result = countBits64(value);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("clzBigInt", () => {
    it("should correctly count leading 0 in bigint (min value)", () => {
      const value = 0n;
      const expectedResult = 64;

      const result = clz64(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count leading 0 in bigint (max value)", () => {
      const value = 2n ** 64n - 1n;
      const expectedResult = 0;

      const result = clz64(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count leading 0 in bigint (negative value)", () => {
      const value = -1n;
      const expectedResult = 0;

      const result = clz64(value);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("ctz32", () => {
    it("should correctly count trailing 0 in number (min value)", () => {
      const value = 0;
      const expectedResult = 32;

      const result = ctz32(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count trailing 0 in number (max value)", () => {
      const value = 2 ** 32 - 1;
      const expectedResult = 0;

      const result = ctz32(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count trailing 0 in number", () => {
      const value = 2 ** 31;
      const expectedResult = 31;

      const result = ctz32(value);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("ctz64", () => {
    it("should correctly count trailing 0 in bigint (min value)", () => {
      const value = 0n;
      const expectedResult = 64;

      const result = ctz64(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count trailing 0 in bigint (max value)", () => {
      const value = 2n ** 64n - 1n;
      const expectedResult = 0;

      const result = ctz64(value);

      assert.strictEqual(result, expectedResult);
    });

    it("should correctly count trailing 0 in bigint", () => {
      const value = 2n ** 63n;
      const expectedResult = 63;

      const result = ctz64(value);

      assert.strictEqual(result, expectedResult);
    });
  });
});
