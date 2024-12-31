import assert from "node:assert";
import { describe, it } from "node:test";
import { IncorrectSbrkIndex } from "./errors";
import { MemoryBuilder } from "./memory-builder";
import { PAGE_SIZE } from "./memory-consts";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "./memory-index";
import { ReadablePage, WriteablePage } from "./pages";
import { tryAsPageNumber } from "./pages/page-utils";

describe("MemoryBuilder", () => {
  describe("finalize", () => {
    it("should work correctly (happy path)", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(1, new ReadablePage(tryAsPageNumber(1), new Uint8Array()));
      pageMap.set(2, new WriteablePage(tryAsPageNumber(2), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(3 * PAGE_SIZE), tryAsSbrkIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw IncorrectSbrkIndex exception when some page are in heap segment", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
          .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
          .finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });
  });

  describe("paged memory", () => {
    it("should add readable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(1, new ReadablePage(tryAsPageNumber(1), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(3 * PAGE_SIZE), tryAsSbrkIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add writeable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(2, new WriteablePage(tryAsPageNumber(2), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(3 * PAGE_SIZE), tryAsSbrkIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add two pages", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(1, new ReadablePage(tryAsPageNumber(1), new Uint8Array()));
      pageMap.set(2, new WriteablePage(tryAsPageNumber(2), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(3 * PAGE_SIZE), tryAsSbrkIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
