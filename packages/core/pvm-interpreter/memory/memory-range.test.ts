import assert from "node:assert";
import { describe, it } from "node:test";
import { PAGE_SIZE } from "./memory-consts";
import { tryAsMemoryIndex } from "./memory-index";
import { MemoryRange } from "./memory-range";

describe("MemoryRange", () => {
  describe("create", () => {
    it("should create a MemoryRange from addresses", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.start, start);
      assert.strictEqual(memoryRange.end, end);
    });

    it("should create a MemoryRange from starting point and length", () => {
      const start = tryAsMemoryIndex(1);
      const length = PAGE_SIZE;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.start, start);
      assert.strictEqual(memoryRange.end, start + PAGE_SIZE);
    });
  });

  describe("isEmpty", () => {
    it("should return true for an empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isEmpty(), true);
    });

    it("should return false for a non-empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isEmpty(), false);
    });
  });

  describe("isWrapped", () => {
    it("should return true for a wrapped range", () => {
      const start = tryAsMemoryIndex(2 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isWrapped(), true);
    });

    it("should return false for a non-wrapped range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isWrapped(), false);
    });
  });

  describe("isInRange", () => {
    it("should return true for a point in range (non-wrapped)", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(3 * PAGE_SIZE);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return true for a point in range (wrapped)", () => {
      const start = tryAsMemoryIndex(3 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);
      const point = tryAsMemoryIndex(4 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return false for a point not in range (non-wrapped)", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);
      const point = tryAsMemoryIndex(3 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return false for a point not in range (wrapped)", () => {
      const start = tryAsMemoryIndex(3 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return false for an empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);
      const point = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return true for a point that is equal to `start`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);
      const point = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });

    it("should return false for a point that is equal to `end`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), false);
    });

    it("should return true for a point that is equal to `end - 1`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(2 * PAGE_SIZE);
      const point = tryAsMemoryIndex(2 * PAGE_SIZE - 1);

      const memoryRange = MemoryRange.fromAddresses(start, end);

      assert.strictEqual(memoryRange.isInRange(point), true);
    });
  });

  describe("overlapsWith", () => {
    it("should return true for overlapping ranges", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(3));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(2), tryAsMemoryIndex(4));

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return true for equal but not empty ranges", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(2));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(2));

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return true for equal but not empty ranges (wrapped)", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(3), tryAsMemoryIndex(2));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(3), tryAsMemoryIndex(2));

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return false for non-overlapping ranges", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(2));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(3), tryAsMemoryIndex(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false for empty range", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(2), tryAsMemoryIndex(2));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false when `end` of the first range is equal to `start` of the second range", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(2));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(2), tryAsMemoryIndex(4));

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false for non-overlapping ranges (wrapped)", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(2), tryAsMemoryIndex(4));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(4), tryAsMemoryIndex(2));

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return true when one range completely contains another", () => {
      const outerRange = MemoryRange.fromAddresses(tryAsMemoryIndex(1), tryAsMemoryIndex(5));
      const innerRange = MemoryRange.fromAddresses(tryAsMemoryIndex(2), tryAsMemoryIndex(4));

      assert.strictEqual(outerRange.overlapsWith(innerRange), true);
      assert.strictEqual(innerRange.overlapsWith(outerRange), true);
    });

    it("should return true for complex overlapping wrapped ranges", () => {
      const range1 = MemoryRange.fromAddresses(tryAsMemoryIndex(3), tryAsMemoryIndex(1));
      const range2 = MemoryRange.fromAddresses(tryAsMemoryIndex(4), tryAsMemoryIndex(2));

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });
  });

  describe("getPageNumbers", () => {
    it("should return page numbers for an empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);
      const pageNumbers = Array.from(memoryRange.getPageNumbers());

      assert.deepStrictEqual(pageNumbers, []);
    });

    it("should return page numbers for a non-empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(3 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromAddresses(start, end);
      const pageNumbers = Array.from(memoryRange.getPageNumbers());

      assert.deepStrictEqual(pageNumbers, [1, 2]);
    });

    it("should return page numbers for a non-empty range and `end` is not the end of a page", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const end = tryAsMemoryIndex(3 * PAGE_SIZE + 5);

      const memoryRange = MemoryRange.fromAddresses(start, end);
      const pageNumbers = Array.from(memoryRange.getPageNumbers());

      assert.deepStrictEqual(pageNumbers, [1, 2, 3]);
    });
  });
});
