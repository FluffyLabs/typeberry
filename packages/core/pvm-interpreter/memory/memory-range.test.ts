import assert from "node:assert";
import { describe, it } from "node:test";
import { PAGE_SIZE } from "./memory-consts";
import { tryAsMemoryIndex } from "./memory-index";
import { MemoryRange } from "./memory-range";
import { tryAsPageNumber } from "./pages/page-utils";

describe("MemoryRange", () => {
  describe("create", () => {
    it("should create a MemoryRange from addresses", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.start, start);
      assert.strictEqual(memoryRange.end, end);
    });

    it("should create a MemoryRange from page numbers", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.start, start * PAGE_SIZE);
      assert.strictEqual(memoryRange.end, end * PAGE_SIZE);
    });
  });

  describe("isEmpty", () => {
    it("should return true for an empty range", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(1);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isEmpty(), true);
    });

    it("should return false for a non-empty range", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isEmpty(), false);
    });
  });

  describe("isWrapped", () => {
    it("should return true for a wrapped range", () => {
      const start = tryAsPageNumber(2);
      const end = tryAsPageNumber(1);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isWrapped(), true);
    });

    it("should return false for a non-wrapped range", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isWrapped(), false);
    });
  });

  describe("isInRange", () => {
    it("should return true for a point in range (non-wrapped)", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(3);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return true for a point in range (wrapped)", () => {
      const start = tryAsPageNumber(3);
      const end = tryAsPageNumber(1);
      const point = tryAsMemoryIndex(4 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return false for a point not in range (non-wrapped)", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);
      const point = tryAsMemoryIndex(3 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return false for a point not in range (wrapped)", () => {
      const start = tryAsPageNumber(3);
      const end = tryAsPageNumber(1);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return false for an empty range", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(1);
      const point = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return true for a point that is equal to start", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);
      const point = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return false for a point that is equal to end", () => {
      const start = tryAsPageNumber(1);
      const end = tryAsPageNumber(2);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromPageNumbers(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });
  });

  describe("overlapsWith", () => {
    it("should return true for overlapping ranges", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(3));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(2), tryAsPageNumber(4));

      assert.strictEqual(range1.overlapsWith(range2), true);
    });

    it("should return true for equal but not empty ranges", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(2));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(2));

      assert.strictEqual(range1.overlapsWith(range2), true);
    });

    it("should return true for equal but not empty ranges (wrapped)", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(3), tryAsPageNumber(2));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(3), tryAsPageNumber(2));

      assert.strictEqual(range1.overlapsWith(range2), true);
    });

    it("should return false for non-overlapping ranges", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(2));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(3), tryAsPageNumber(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
    });

    it("should return false for empty range", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(2), tryAsPageNumber(2));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
    });

    it("should return false when end of the first range is equal to start of the second range", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(1), tryAsPageNumber(2));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(2), tryAsPageNumber(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
    });

    it("should return false for non-overlapping ranges (wrapped)", () => {
      const range1 = MemoryRange.fromPageNumbers(tryAsPageNumber(2), tryAsPageNumber(4));
      const range2 = MemoryRange.fromPageNumbers(tryAsPageNumber(4), tryAsPageNumber(2));

      assert.strictEqual(range1.overlapsWith(range2), false);
    });
  });
});
