import assert from "node:assert";
import { describe, it } from "node:test";

import { MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "./memory-consts";
import { createMemoryIndex } from "./memory-index";
import { alignToMinimalAllocationLength, alignToPageSize, getPageNumber } from "./memory-utils";
import { createPageNumber } from "./page-number";

describe("memory-utils", () => {
  describe("getPageNumber", () => {
    it("should return 0 if address is less than page size", () => {
      const address = createMemoryIndex(5 % PAGE_SIZE);

      const pageNumber = getPageNumber(address);

      assert.strictEqual(pageNumber, createPageNumber(0));
    });

    it("should return 1 if address is bigger than page size but less than 2x page size", () => {
      const address = createMemoryIndex(PAGE_SIZE + ((PAGE_SIZE + 5) % PAGE_SIZE));

      const pageNumber = getPageNumber(address);

      assert.strictEqual(pageNumber, createPageNumber(1));
    });
  });

  describe("alignToPageSize", () => {
    it("should return 0 for 0", () => {
      const length = 0;

      const lengthAligned = alignToPageSize(length);

      assert.strictEqual(lengthAligned, 0);
    });

    it("should return PAGE_SIZE for 1", () => {
      const length = 1;

      const lengthAligned = alignToPageSize(length);

      assert.strictEqual(lengthAligned, PAGE_SIZE);
    });

    it("should return 2xPAGE_SIZE for PAGE_SIZE + 1", () => {
      const length = PAGE_SIZE + 1;

      const lengthAligned = alignToPageSize(length);

      assert.strictEqual(lengthAligned, 2 * PAGE_SIZE);
    });
  });

  describe("alignToMinimalAllocationLength", () => {
    it("should return MIN_ALLOCATION_LENGTH for 0", () => {
      const length = 0;

      const lengthAligned = alignToMinimalAllocationLength(length);

      assert.strictEqual(lengthAligned, MIN_ALLOCATION_LENGTH);
    });

    it("should return 2 * MIN_ALLOCATION_LENGTH for MIN_ALLOCATION_LENGTH + 1", () => {
      const length = MIN_ALLOCATION_LENGTH + 1;

      const lengthAligned = alignToMinimalAllocationLength(length);

      assert.strictEqual(lengthAligned, 2 * MIN_ALLOCATION_LENGTH);
    });

    it("should not return a value bigger than PAGE_SIZE", () => {
      const length = 2 * PAGE_SIZE;

      const lengthAligned = alignToMinimalAllocationLength(length);

      assert.strictEqual(lengthAligned, PAGE_SIZE);
    });
  });
});
