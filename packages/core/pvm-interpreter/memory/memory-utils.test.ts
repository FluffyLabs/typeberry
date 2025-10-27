import assert from "node:assert";
import { describe, it } from "node:test";
import { MAX_MEMORY_INDEX, MEMORY_SIZE } from "@typeberry/pvm-interface";
import { PAGE_SIZE } from "./memory-consts.js";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "./memory-index.js";
import { alignToPageSize, getPageNumber, getStartPageIndex, getStartPageIndexFromPageNumber } from "./memory-utils.js";
import { tryAsPageNumber } from "./pages/page-utils.js";

describe("memory-utils", () => {
  describe("getPageNumber", () => {
    it("should return 0 if address is less than page size", () => {
      const address = tryAsMemoryIndex(5 % PAGE_SIZE);

      const pageNumber = getPageNumber(address);

      assert.strictEqual(pageNumber, tryAsPageNumber(0));
    });

    it("should return 1 if address is bigger than page size but less than 2x page size", () => {
      const address = tryAsMemoryIndex(PAGE_SIZE + ((PAGE_SIZE + 5) % PAGE_SIZE));

      const pageNumber = getPageNumber(address);

      assert.strictEqual(pageNumber, tryAsPageNumber(1));
    });

    it("should return first page for max sbrk index", () => {
      const address = tryAsSbrkIndex(MEMORY_SIZE);

      const pageNumber = getPageNumber(address);

      assert.strictEqual(pageNumber, 0);
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

  describe("getStartPageIndex", () => {
    it("should return start index of 1st page", () => {
      const address = tryAsMemoryIndex(1);
      const expectedAddress = 0;

      const startPageIndex = getStartPageIndex(address);

      assert.strictEqual(startPageIndex, expectedAddress);
    });

    it("should return start index of 10th page", () => {
      const address = tryAsMemoryIndex(1 + 10 * PAGE_SIZE);
      const expectedAddress = 10 * PAGE_SIZE;

      const startPageIndex = getStartPageIndex(address);

      assert.strictEqual(startPageIndex, expectedAddress);
    });
  });

  describe("getStartPageIndexFromPageNumber", () => {
    it("should return a correct start index for page 0", () => {
      const pageNumber = tryAsPageNumber(0);
      const expectedMemoryIndex = tryAsMemoryIndex(0);

      const startIndex = getStartPageIndexFromPageNumber(pageNumber);

      assert.strictEqual(startIndex, expectedMemoryIndex);
    });

    it("should return a correct start index for page 1", () => {
      const pageNumber = tryAsPageNumber(1);
      const expectedMemoryIndex = tryAsMemoryIndex(PAGE_SIZE);

      const startIndex = getStartPageIndexFromPageNumber(pageNumber);

      assert.strictEqual(startIndex, expectedMemoryIndex);
    });

    it("should return a correct start index for the last page", () => {
      const lastMemoryIndex = tryAsMemoryIndex(MAX_MEMORY_INDEX);
      const pageNumber = getPageNumber(lastMemoryIndex);

      const startIndex = getStartPageIndexFromPageNumber(pageNumber);

      assert.strictEqual(startIndex, pageNumber * PAGE_SIZE);
    });
  });
});
