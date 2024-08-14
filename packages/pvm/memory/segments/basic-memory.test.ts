import assert from "node:assert";
import { describe, it } from "node:test";
import { BasicMemory } from "./basic-memory";

describe("BasicMemory", () => {
  describe("initialization", () => {
    it("should set data and return correct length", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4]);

      basicMemory.setup(data);

      assert.strictEqual(basicMemory.length, data.length);
    });
  });

  describe("resize", () => {
    it("should return correct length after resize", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4]);
      basicMemory.setup(data);
      const targetLength = 8;

      basicMemory.resize(targetLength);

      assert.strictEqual(basicMemory.length, targetLength);
    });

    it("should not resize if target size is lower that current length", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4]);
      basicMemory.setup(data);
      const targetLength = 2;

      basicMemory.resize(targetLength);

      assert.strictEqual(basicMemory.length, data.length);
    });
  });

  describe("store", () => {
    it("should override part of initial heap", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4, 0]);
      basicMemory.setup(data);
      const dataToStore = new Uint8Array([5, 6, 7, 8]);
      const expectedMemory = [{ address: 0, contents: new Uint8Array([1, 5, 6, 7, 8]) }];

      basicMemory.store(1, dataToStore);

      assert.deepStrictEqual(basicMemory.getMemoryDump(0), expectedMemory);
    });

    it("should store 2 bytes", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4, 0, 0]);
      basicMemory.setup(data);
      const dataToStore = new Uint8Array([5, 6]);
      const expectedMemory = [{ address: 0, contents: new Uint8Array([1, 2, 3, 4, 5, 6]) }];

      basicMemory.store(4, dataToStore);

      assert.deepStrictEqual(basicMemory.getMemoryDump(0), expectedMemory);
    });
  });

  describe("load", () => {
    it("should load 4 bytes from memory initialized with 4 bytes", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2, 3, 4]);
      basicMemory.setup(data);

      const result = basicMemory.load(0, 4);

      assert.deepStrictEqual(result, data);
    });

    it("should load 4 bytes from memory initialized with 2 bytes", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array([1, 2]);
      basicMemory.setup(data);
      const expectedResult = new Uint8Array([1, 2, 0, 0]);

      const result = basicMemory.load(0, 4);

      assert.deepStrictEqual(result, expectedResult);
    });

    it("should load 4 bytes from not initialized memory", () => {
      const basicMemory = new BasicMemory();
      const data = new Uint8Array();
      basicMemory.setup(data);
      const expectedResult = new Uint8Array([0, 0, 0, 0]);

      const result = basicMemory.load(0, 4);

      assert.deepStrictEqual(result, expectedResult);
    });
  });
});
