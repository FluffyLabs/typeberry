import assert from "node:assert";
import { describe, it } from "node:test";

import { MAX_VALUE } from "./math-consts";
import { addWithOverflowU32, mulLowerUnsignedU32, mulUpperSigned, mulUpperUnsigned, subU32 } from "./math-utils";

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

  describe("mulUpperUnsigned", () => {
    it("should multiply two small numbers", () => {
      const a = 5;
      const b = 6;
      const expectedResult = 0;

      const result = mulUpperUnsigned(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply two numbers", () => {
      const a = 2 ** 30;
      const b = 2 ** 30;
      const expectedResult = 268435456;

      const result = mulUpperUnsigned(a, b);

      assert.strictEqual(result, expectedResult);
    });

    it("should multiply max values", () => {
      const a = MAX_VALUE;
      const b = MAX_VALUE;
      const expectedResult = (MAX_VALUE - 1) | 0;

      const result = mulUpperUnsigned(a, b);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("mulUpperSigned", () => {
    describe("small numbers", () => {
      it("should multiply two positive numbers", () => {
        const a = 5;
        const b = 6;
        const expectedResult = 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply negative and positive numbers", () => {
        const a = -5;
        const b = 6;
        const expectedResult = 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply positive and negative numbers", () => {
        const a = 5;
        const b = -6;
        const expectedResult = 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply two negative numbers", () => {
        const a = -5;
        const b = -6;
        const expectedResult = 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });
    });

    describe("max values", () => {
      it("should multiply two positive numbers", () => {
        const a = MAX_VALUE;
        const b = MAX_VALUE;
        const expectedResult = (MAX_VALUE - 1) | 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply positive and negative numbers", () => {
        const a = MAX_VALUE;
        const b = -MAX_VALUE;
        const expectedResult = -(MAX_VALUE - 1) | 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply negative and positive numbers", () => {
        const a = -MAX_VALUE;
        const b = MAX_VALUE;
        const expectedResult = -(MAX_VALUE - 1) | 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });

      it("should multiply two negative numbers", () => {
        const a = -MAX_VALUE;
        const b = -MAX_VALUE;
        const expectedResult = (MAX_VALUE - 1) | 0;

        const result = mulUpperSigned(a, b);

        assert.strictEqual(result, expectedResult);
      });
    });
  });
});
