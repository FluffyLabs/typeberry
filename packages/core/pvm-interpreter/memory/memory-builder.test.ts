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
      pageMap.set(16, new ReadablePage(tryAsPageNumber(16), new Uint8Array()));
      pageMap.set(17, new WriteablePage(tryAsPageNumber(17), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 20 * PAGE_SIZE,
        sbrkIndex: 18 * PAGE_SIZE,
        virtualSbrkIndex: 18 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(16 * PAGE_SIZE), tryAsMemoryIndex(17 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(17 * PAGE_SIZE), tryAsMemoryIndex(18 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(18 * PAGE_SIZE), tryAsSbrkIndex(20 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw IncorrectSbrkIndex exception when some page are in heap segment", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(tryAsMemoryIndex(16 * PAGE_SIZE), tryAsMemoryIndex(17 * PAGE_SIZE), new Uint8Array())
          .setWriteablePages(tryAsMemoryIndex(17 * PAGE_SIZE), tryAsMemoryIndex(18 * PAGE_SIZE), new Uint8Array())
          .finalize(tryAsSbrkIndex(16 * PAGE_SIZE), tryAsSbrkIndex(20 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });
  });

  describe("paged memory", () => {
    it("should add readable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(16, new ReadablePage(tryAsPageNumber(16), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 19 * PAGE_SIZE,
        sbrkIndex: 18 * PAGE_SIZE,
        virtualSbrkIndex: 18 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(16 * PAGE_SIZE), tryAsMemoryIndex(17 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(18 * PAGE_SIZE), tryAsSbrkIndex(19 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add writeable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(18, new WriteablePage(tryAsPageNumber(18), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 20 * PAGE_SIZE,
        sbrkIndex: 19 * PAGE_SIZE,
        virtualSbrkIndex: 19 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(tryAsMemoryIndex(18 * PAGE_SIZE), tryAsMemoryIndex(19 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(19 * PAGE_SIZE), tryAsSbrkIndex(20 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add two pages", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(16, new ReadablePage(tryAsPageNumber(16), new Uint8Array()));
      pageMap.set(17, new WriteablePage(tryAsPageNumber(17), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 20 * PAGE_SIZE,
        sbrkIndex: 18 * PAGE_SIZE,
        virtualSbrkIndex: 18 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(16 * PAGE_SIZE), tryAsMemoryIndex(17 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(17 * PAGE_SIZE), tryAsMemoryIndex(18 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsSbrkIndex(18 * PAGE_SIZE), tryAsSbrkIndex(20 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });
  });

  describe("setData", () => {
    it("should add writeable page and set data separately", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const data = new Uint8Array(PAGE_SIZE).fill(1);
      const pageNumber = tryAsPageNumber(16);
      const address = tryAsMemoryIndex(pageNumber * PAGE_SIZE);
      pageMap.set(pageNumber, new WriteablePage(pageNumber, data));
      const expectedMemory = {
        endHeapIndex: 20 * PAGE_SIZE,
        sbrkIndex: 18 * PAGE_SIZE,
        virtualSbrkIndex: 18 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(tryAsMemoryIndex(16 * PAGE_SIZE), tryAsMemoryIndex(17 * PAGE_SIZE))
        .setData(address, data)
        .finalize(tryAsSbrkIndex(18 * PAGE_SIZE), tryAsSbrkIndex(20 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
