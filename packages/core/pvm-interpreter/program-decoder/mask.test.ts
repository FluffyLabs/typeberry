import assert from "node:assert";
import { describe, it } from "node:test";

import { BitVec } from "@typeberry/bytes";
import { Mask } from "./mask";

describe("Mask", () => {
  describe("isInstruction", () => {
    it("should return true (single byte)", () => {
      const input = [0b0000_0001];

      const index = 0;
      const expectedResult = true;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 3));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return false (single byte)", () => {
      const input = [0b0000_0001];
      const index = 1;
      const expectedResult = false;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 3));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return true (2 bytes)", () => {
      const input = [0x0, 0b0000_0001];
      const index = 8;
      const expectedResult = true;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 11));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return false (2 bytes)", () => {
      const input = [0xff, 0b0000_0001];
      const index = 10;
      const expectedResult = false;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 11));

      const result = mask.isInstruction(index);

      assert.strictEqual(result, expectedResult);
    });
  });

  describe("getNoOfBytesToNextInstruction", () => {
    it("should return distance to the end of program", () => {
      const input = [0b0000_0001];
      const index = 1;
      const expectedResult = 2;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 3));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return distance to the next instruction in single byte", () => {
      const input = [0b0000_1001];
      const index = 1;
      const expectedResult = 2;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 8));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return 0 if the bit value is 1", () => {
      const input = [0b0000_0001];
      const index = 0;
      const expectedResult = 0;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 3));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return number of 0s between two 1 in 2 bytes", () => {
      const input = [0b0001_1001, 0b0001_1000];
      const index = 5;
      const expectedResult = 6;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 16));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return distance to the end of program", () => {
      const input = [0b0001_1001];
      const index = 5;
      const expectedResult = 3;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), 8));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });

    it("should return MAX_INSTRUCTION_DISTANCE = 24 if the real distance is longer", () => {
      const input = [0b0000_0001, 0b0000_0000, 0b0000_0000, 0b1000_0000];
      const index = 1;
      const expectedResult = 25;
      const mask = new Mask(BitVec.fromBlob(new Uint8Array(input), input.length * 8));

      const result = mask.getNoOfBytesToNextInstruction(index);

      assert.strictEqual(result, expectedResult);
    });
  });
});
