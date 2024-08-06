import assert from "node:assert";
import { describe, it } from "node:test";

import { Mask } from "./mask";

describe("Mask", () => {
  describe("isInstruction", () => {
    it("should return true (single byte)", () => {
      const input = [0b1111_1001];
      const index = 0;
      const expectedResult = true;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return false (single byte)", () => {
      const input = [0b1111_1001];
      const index = 1;
      const expectedResult = false;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return true (2 bytes)", () => {
      const input = [0x0, 0b1111_1001];
      const index = 8;
      const expectedResult = true;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return false (2 bytes)", () => {
      const input = [0xff, 0b1111_1001];
      const index = 10;
      const expectedResult = false;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("getNoOfBytesToNextInstruction", () => {
    it("number of 0s between two 1 in single byte", () => {
      const input = [0b1111_1001];
      const index = 0;
      const expectedResult = 3;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("number of 0s from current index (that is 1) to next 1", () => {
      const input = [0b1111_1001];
      const index = 1;
      const expectedResult = 2;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("number of 0s between two 1 in 2 bytes", () => {
      const input = [0b0001_1001, 0b0001_1000];
      const index = 4;
      const expectedResult = 7;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("number of 0s between to the end", () => {
      const input = [0b0001_1001];
      const index = 4;
      const expectedResult = 4;
      const mask = new Mask(new Uint8Array(input));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });
  });
});
