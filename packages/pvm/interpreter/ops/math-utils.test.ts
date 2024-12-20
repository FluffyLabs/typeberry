import assert from "node:assert";
import { describe, it } from "node:test";

import { MAX_VALUE, MAX_VALUE_U64 } from "./math-consts";
import {
  addWithOverflowU32,
  addWithOverflowU64,
  mulLowerUnsignedU32,
  mulU64,
  mulUpperSS,
  mulUpperSU,
  mulUpperUU,
  subU32,
  subU64,
  unsignedRightShiftBigInt,
} from "./math-utils";

describe("math-utils", () => {
  describe("addWithOverflow", () => {
    it("should add two numbers without overflow", () => {
      const a = 5;
      const b = 6;
      const expectedResult = 11;

      const result = addWithOverflowU32(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should add two numbers (big and small) without overflow", () => {
      const a = MAX_VALUE;
      const b = 6;
      const expectedResult = 5;

      const result = addWithOverflowU32(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should add two numbers with overflow", () => {
      const a = 2 ** 31 + 5;
      const b = 2 ** 31 + 6;
      const expectedResult = 11;

      const result = addWithOverflowU32(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should add max values with overflow", () => {
      const a = MAX_VALUE;
      const b = MAX_VALUE;
      const expectedResult = MAX_VALUE - 1;

      const result = addWithOverflowU32(a, b);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("sub", () => {
    it("should subtract two numbers without overflow", () => {
      const a = 5;
      const b = 6;
      const expectedResult = 1;

      const result = subU32(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should subtract two numbers with overflow", () => {
      const a = 6;
      const b = 5;
      const expectedResult = MAX_VALUE;

      const result = subU32(a, b);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("mulUnsigned", () => {
    it("should multiply two numbers without overflow", () => {
      const a = 5;
      const b = 6;
      const expectedResult = 30;

      const result = mulLowerUnsignedU32(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two numbers with overflow", () => {
      const a = 2 ** 17 + 1;
      const b = 2 ** 18;
      const expectedResult = 262144;

      const result = mulLowerUnsignedU32(a, b);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("mulUpperUU", () => {
    it("should multiply two positive numbers", () => {
      const a = 5n;
      const b = 6n;
      const expectedResult = 0n;

      const result = mulUpperUU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply negative and positive numbers", () => {
      const a = -5n;
      const b = 6n;
      const expectedResult = 5n;

      const result = mulUpperUU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply positive and negative numbers", () => {
      const a = 5n;
      const b = -6n;
      const expectedResult = 4n;

      const result = mulUpperUU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two negative numbers", () => {
      const a = -5n;
      const b = -6n;
      const expectedResult = 0xfffffffffffffff5n;

      const result = mulUpperUU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive numbers", () => {
      const a = MAX_VALUE_U64;
      const b = MAX_VALUE_U64;
      const expectedResult = 0x4000000000000000n;
      const result = mulUpperUU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive and negative numbers", () => {
      const a = MAX_VALUE_U64;
      const b = -MAX_VALUE_U64;
      const expectedResult = 4611686018427387904n;
      const result = mulUpperUU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative and positive numbers", () => {
      const a = -MAX_VALUE_U64;
      const b = MAX_VALUE_U64;
      const expectedResult = 4611686018427387904n;
      const result = mulUpperUU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative numbers", () => {
      const a = -MAX_VALUE_U64;
      const b = -MAX_VALUE_U64;
      const expectedResult = 0x4000000000000000n;
      const result = mulUpperUU(a, b);
      assert.strictEqual(result, expectedResult);
    });
  });

  describe("mulUpperSU", () => {
    it("should multiply two positive numbers", () => {
      const a = 5n;
      const b = 6n;
      const expectedResult = 0n;

      const result = mulUpperSU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply negative and positive numbers", () => {
      const a = -5n;
      const b = 6n;
      const expectedResult = -1n;

      const result = mulUpperSU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply positive and negative numbers", () => {
      const a = 5n;
      const b = -6n;
      const expectedResult = 4n;

      const result = mulUpperSU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two negative numbers", () => {
      const a = -5n;
      const b = -6n;
      const expectedResult = -5n;

      const result = mulUpperSU(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive numbers", () => {
      const a = MAX_VALUE_U64;
      const b = MAX_VALUE_U64;
      const expectedResult = 0x4000000000000000n;
      const result = mulUpperSU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive and negative numbers", () => {
      const a = 2n ** 60n;
      const b = -(2n ** 60n);
      const expectedResult = 0xf00000000000000n;
      const result = mulUpperSU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative and positive numbers", () => {
      const a = -(2n ** 60n);
      const b = 2n ** 60n;
      const expectedResult = -(2n ** 56n);
      const result = mulUpperSU(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative numbers", () => {
      const a = -(2n ** 60n);
      const b = -(2n ** 60n);
      const expectedResult = -0xf00000000000000n;
      const result = mulUpperSU(a, b);
      assert.strictEqual(result, expectedResult);
    });
  });

  describe("mulUpperSS", () => {
    it("should multiply two positive numbers", () => {
      const a = 5n;
      const b = 6n;
      const expectedResult = 0n;

      const result = mulUpperSS(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply negative and positive numbers", () => {
      const a = -5n;
      const b = 6n;
      const expectedResult = -1n;

      const result = mulUpperSS(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply positive and negative numbers", () => {
      const a = 5n;
      const b = -6n;
      const expectedResult = -1n;

      const result = mulUpperSS(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two negative numbers", () => {
      const a = -5n;
      const b = -6n;
      const expectedResult = 0n;

      const result = mulUpperSS(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive numbers", () => {
      const a = 2n ** 60n;
      const b = 2n ** 60n;
      const expectedResult = 2n ** 56n;
      const result = mulUpperSS(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big positive and negative numbers", () => {
      const a = 2n ** 60n;
      const b = -(2n ** 60n);
      const expectedResult = -0x100000000000000n;
      const result = mulUpperSS(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative and positive numbers", () => {
      const a = -(2n ** 60n);
      const b = 2n ** 60n;
      const expectedResult = -0x100000000000000n;
      const result = mulUpperSS(a, b);
      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two big negative numbers", () => {
      const a = -(2n ** 60n);
      const b = -(2n ** 60n);
      const expectedResult = 2n ** 56n;
      const result = mulUpperSS(a, b);
      assert.strictEqual(result, expectedResult);
    });
  });

  describe("unsignedRightShiftBigInt", () => {
    it("0 >>> 5 === 0", () => {
      const value = 0n;
      const shift = 5n;
      const expectedResult = 0n;

      const result = unsignedRightShiftBigInt(value, shift);

      assert.deepStrictEqual(result, expectedResult);
    });

    it("-5 >>> 0 === 2 ** 64 - 5", () => {
      const value = -5n;
      const shift = 0n;
      const expectedResult = 2n ** 64n - 5n;

      const result = unsignedRightShiftBigInt(value, shift);

      assert.deepStrictEqual(result, expectedResult);
    });

    it("5 >>> 0 === 5", () => {
      const value = 5n;
      const shift = 0n;
      const expectedResult = 5n;

      const result = unsignedRightShiftBigInt(value, shift);

      assert.deepStrictEqual(result, expectedResult);
    });

    it("1 >>> 5 === 0", () => {
      const value = 1n;
      const shift = 5n;
      const expectedResult = 0n;

      const result = unsignedRightShiftBigInt(value, shift);

      assert.deepStrictEqual(result, expectedResult);
    });

    it("0xffff_ffff_ffff_ffff >>> 20 === 0x0000_0fff_ffff_ffff", () => {
      const value = 0xffff_ffff_ffff_ffffn;
      const shift = 20n;
      const expectedResult = 0x0000_0fff_ffff_ffffn;

      const result = unsignedRightShiftBigInt(value, shift);

      assert.deepStrictEqual(result, expectedResult);
    });

    describe("addWithOverflowU64", () => {
      it("5 + 5 === 10", () => {
        const value1 = 5n;
        const value2 = 5n;
        const expectedResult = 10n;

        const result = addWithOverflowU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });

      it("5 + 2 ** 64 === 5", () => {
        const value1 = 5n;
        const value2 = 2n ** 64n;
        const expectedResult = 5n;

        const result = addWithOverflowU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });
    });

    describe("subU64", () => {
      it("2 - 5 === 2 ** 64 - 3", () => {
        const value1 = 5n;
        const value2 = 2n;
        const expectedResult = 2n ** 64n - 3n;

        const result = subU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });

      it("5 - 2 === 3", () => {
        const value1 = 2n;
        const value2 = 5n;
        const expectedResult = 3n;

        const result = subU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });
    });

    describe("mulU64", () => {
      it("5 * 5 === 25", () => {
        const value1 = 5n;
        const value2 = 5n;
        const expectedResult = 25n;

        const result = mulU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });

      it("2 ** 63 * 2 === 0", () => {
        const value1 = 2n ** 63n;
        const value2 = 2n;
        const expectedResult = 0n;

        const result = mulU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });

      it("2 ** 63 * (2 ** 63 + 1) === 2 ** 63 * 2 ** 63 + 2 ** 63 === 2 ** 63", () => {
        const value1 = 2n ** 63n;
        const value2 = 2n ** 63n + 1n;
        const expectedResult = 2n ** 63n;

        const result = mulU64(value1, value2);

        assert.deepStrictEqual(result, expectedResult);
      });
    });
  });
});
