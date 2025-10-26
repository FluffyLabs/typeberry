import assert from "node:assert";
import { describe, it } from "node:test";
import { MEMORY_SIZE } from "@typeberry/pvm-interface";
import { PAGE_SIZE } from "./memory-consts.js";
import { tryAsMemoryIndex } from "./memory-index.js";
import { MemoryRange } from "./memory-range.js";

describe("MemoryRange", () => {
  describe("create", () => {
    it("should create a MemoryRange from addresses", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const expectedEnd = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.start, start);
      assert.strictEqual(memoryRange.end, expectedEnd);
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
      const length = 0;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isEmpty(), true);
    });

    it("should return false for a non-empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isEmpty(), false);
    });

    it("should return false for full range", () => {
      const start = tryAsMemoryIndex(0);
      const length = MEMORY_SIZE;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isEmpty(), false);
    });
  });

  describe("isWrapped", () => {
    it("should return true for a wrapped range", () => {
      const start = tryAsMemoryIndex(2 * PAGE_SIZE);
      const length = MEMORY_SIZE - 5;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isWrapped(), true);
    });

    it("should return false for a non-wrapped range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isWrapped(), false);
    });
  });

  describe("isInRange", () => {
    it("should return true for a point in range (non-wrapped)", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE + 1;
      const address = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), true);
    });

    it("should return true for a point in range (wrapped)", () => {
      const start = tryAsMemoryIndex(3 * PAGE_SIZE);
      const length = MEMORY_SIZE - PAGE_SIZE;
      const address = tryAsMemoryIndex(4 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), true);
    });

    it("should return false for a point not in range (non-wrapped)", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const address = tryAsMemoryIndex(3 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), false);
    });

    it("should return false for a point not in range (wrapped)", () => {
      const start = tryAsMemoryIndex(3 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const address = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), false);
    });

    it("should return false for an empty range", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = 0;
      const address = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), false);
    });

    it("should return true for a point that is equal to `start`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const address = tryAsMemoryIndex(1 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), true);
    });

    it("should return false for a point that is equal to `end`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const address = tryAsMemoryIndex(2 * PAGE_SIZE);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), false);
    });

    it("should return true for a point that is equal to `end - 1`", () => {
      const start = tryAsMemoryIndex(1 * PAGE_SIZE);
      const length = PAGE_SIZE;
      const address = tryAsMemoryIndex(2 * PAGE_SIZE - 1);

      const memoryRange = MemoryRange.fromStartAndLength(start, length);

      assert.strictEqual(memoryRange.isInRange(address), true);
    });
  });

  describe("overlapsWith", () => {
    it("should return true for overlapping ranges", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 2);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(2), 2);

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return true for equal but not empty ranges", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 1);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 1);

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return true for equal but not empty ranges (wrapped)", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(3), MEMORY_SIZE - 1);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(3), MEMORY_SIZE - 1);

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return false for non-overlapping ranges", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 1);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(3), 1);

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false for empty range", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(2), 0);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 3);

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false when `end` of the first range is equal to `start` of the second range", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 1);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(2), 3);

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return false for non-overlapping ranges (wrapped)", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(2), 2);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(4), MEMORY_SIZE - 2);

      assert.strictEqual(range1.overlapsWith(range2), false);
      assert.strictEqual(range2.overlapsWith(range1), false);
    });

    it("should return true when one range completely contains another", () => {
      const outerRange = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), 4);
      const innerRange = MemoryRange.fromStartAndLength(tryAsMemoryIndex(2), 2);

      assert.strictEqual(outerRange.overlapsWith(innerRange), true);
      assert.strictEqual(innerRange.overlapsWith(outerRange), true);
    });

    it("should return true for complex overlapping wrapped ranges", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(3), MEMORY_SIZE - 2);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(4), MEMORY_SIZE - 2);

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });

    it("should return true for non empty and full ranges", () => {
      const range1 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(1), PAGE_SIZE);
      const range2 = MemoryRange.fromStartAndLength(tryAsMemoryIndex(0), MEMORY_SIZE);

      assert.strictEqual(range1.overlapsWith(range2), true);
      assert.strictEqual(range2.overlapsWith(range1), true);
    });
  });

  describe("getPageNumbers", () => {});
});
