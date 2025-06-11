import assert from "node:assert";
import { describe, it } from "node:test";
import { MAX_MEMORY_INDEX, MAX_NUMBER_OF_PAGES, MEMORY_SIZE, PAGE_SIZE } from "./memory-consts.js";
import { tryAsMemoryIndex } from "./memory-index.js";
import { MemoryRange } from "./memory-range.js";
import { PageRange } from "./page-range.js";
import { tryAsPageNumber } from "./pages/page-utils.js";

describe("PageRange", () => {
  describe("create from memory range", () => {
    const createMemoryRange = (start: number, length: number) =>
      MemoryRange.fromStartAndLength(tryAsMemoryIndex(start), length);

    it("should create a PageRange from an empty MemoryRange", () => {
      const range = createMemoryRange(5, 0);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, 0);
      assert.strictEqual(pageRange.end, 0);
      assert.deepStrictEqual(pageNumbers, []);
    });

    it("should create a PageRange from a MemoryRange on one page", () => {
      const range = createMemoryRange(1, 4);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, 0);
      assert.strictEqual(pageRange.end, 1);
      assert.deepStrictEqual(pageNumbers, [0]);
    });

    it("should create a PageRange from a MemoryRange that spans a few pages", () => {
      const range = createMemoryRange(5000, PAGE_SIZE * 3);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, 1);
      assert.strictEqual(pageRange.end, 5);
      assert.deepStrictEqual(pageNumbers, [1, 2, 3, 4]);
    });

    it("should create a PageRange from full MemoryRange", () => {
      const range = createMemoryRange(0, MEMORY_SIZE);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, 0);
      assert.strictEqual(pageRange.end, 0);
      assert.strictEqual(pageNumbers.length, MAX_NUMBER_OF_PAGES);
    });

    it("should create a PageRange from full MemoryRange but different than [0; 2**32)", () => {
      const range = createMemoryRange(5 * PAGE_SIZE + 5, MEMORY_SIZE);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, 5);
      assert.strictEqual(pageRange.end, 5);
      assert.strictEqual(pageNumbers.length, MAX_NUMBER_OF_PAGES);
    });

    it("should create a PageRange from a wrapped range", () => {
      const range = createMemoryRange(MEMORY_SIZE - 3 * PAGE_SIZE + 5, PAGE_SIZE * 4);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.strictEqual(pageRange.start, MAX_NUMBER_OF_PAGES - 3);
      assert.strictEqual(pageRange.end, 2);
      assert.deepStrictEqual(pageNumbers, [
        MAX_NUMBER_OF_PAGES - 3,
        MAX_NUMBER_OF_PAGES - 2,
        MAX_NUMBER_OF_PAGES - 1,
        0,
        1,
      ]);
    });
  });

  describe("iterator", () => {
    it("should return page numbers for an empty range", () => {
      const start = tryAsPageNumber(1);
      const length = 0;

      const pageRange = PageRange.fromStartAndLength(start, length);

      const pageNumbers = Array.from(pageRange);

      assert.deepStrictEqual(pageNumbers, []);
    });

    it("should return page numbers for a non-empty range", () => {
      const start = tryAsPageNumber(1);
      const length = tryAsPageNumber(2);

      const pageRange = PageRange.fromStartAndLength(start, length);

      const pageNumbers = Array.from(pageRange);

      assert.deepStrictEqual(pageNumbers, [1, 2]);
    });

    it("should return page numbers for a non-empty wrapped range", () => {
      const start = tryAsPageNumber(MAX_NUMBER_OF_PAGES - 2);
      const length = 4;

      const pageRange = PageRange.fromStartAndLength(start, length);

      const pageNumbers = Array.from(pageRange);

      assert.deepStrictEqual(pageNumbers, [MAX_NUMBER_OF_PAGES - 2, MAX_NUMBER_OF_PAGES - 1, 0, 1]);
    });

    it("should return page numbers for a short memory range that spans last and first pages ", () => {
      const start = tryAsMemoryIndex(MAX_MEMORY_INDEX - 2);
      const length = 4;
      const range = MemoryRange.fromStartAndLength(start, length);

      const pageRange = PageRange.fromMemoryRange(range);
      const pageNumbers = Array.from(pageRange);

      assert.deepStrictEqual(pageNumbers, [MAX_NUMBER_OF_PAGES - 1, 0]);
    });
  });
});
