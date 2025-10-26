import assert from "node:assert";
import { describe, it } from "node:test";
import { MEMORY_SIZE } from "@typeberry/pvm-interface";
import { IncorrectSbrkIndex } from "./errors.js";
import { MemoryBuilder } from "./memory-builder.js";
import { PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "./memory-consts.js";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "./memory-index.js";
import { ReadablePage, WriteablePage } from "./pages/index.js";
import { tryAsPageNumber } from "./pages/page-utils.js";

describe("MemoryBuilder", () => {
  describe("finalize", () => {
    it("should work correctly (happy path)", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES,
        new ReadablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES), new Uint8Array()),
      );
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES + 1,
        new WriteablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES + 1), new Uint8Array()),
      );
      const expectedMemory = {
        endHeapIndex: (RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE,
        sbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        virtualSbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(
          tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
          new Uint8Array(),
        )
        .setWriteablePages(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          new Uint8Array(),
        )
        .finalize(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE),
        );

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw IncorrectSbrkIndex exception when some page are in heap segment", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(
            tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
            tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
            new Uint8Array(),
          )
          .setWriteablePages(
            tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
            tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
            new Uint8Array(),
          )
          .finalize(
            tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
            tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE),
          );

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });

    it("should correctly finalize empty memory with full range heap", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const heapStart = RESERVED_NUMBER_OF_PAGES * PAGE_SIZE;
      const heapEnd = MEMORY_SIZE;
      const expectedMemory = {
        endHeapIndex: heapEnd,
        sbrkIndex: heapStart,
        virtualSbrkIndex: heapStart,
        memory: pageMap,
      };

      const memory = builder.finalize(tryAsMemoryIndex(heapStart), tryAsSbrkIndex(heapEnd));

      assert.deepEqual(memory, expectedMemory);
    });
  });

  describe("paged memory", () => {
    it("should add readable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES,
        new ReadablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES), new Uint8Array()),
      );
      const expectedMemory = {
        endHeapIndex: (RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE,
        sbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        virtualSbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(
          tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
          new Uint8Array(),
        )
        .finalize(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE),
        );

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add writeable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES + 2,
        new WriteablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES + 2), new Uint8Array()),
      );
      const expectedMemory = {
        endHeapIndex: (RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE,
        sbrkIndex: (RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE,
        virtualSbrkIndex: (RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE),
          new Uint8Array(),
        )
        .finalize(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 3) * PAGE_SIZE),
          tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE),
        );

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add two pages", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES,
        new ReadablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES), new Uint8Array()),
      );
      pageMap.set(
        RESERVED_NUMBER_OF_PAGES + 1,
        new WriteablePage(tryAsPageNumber(RESERVED_NUMBER_OF_PAGES + 1), new Uint8Array()),
      );
      const expectedMemory = {
        endHeapIndex: (RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE,
        sbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        virtualSbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(
          tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
          new Uint8Array(),
        )
        .setWriteablePages(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          new Uint8Array(),
        )
        .finalize(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE),
        );

      assert.deepEqual(memory, expectedMemory);
    });
  });

  describe("setData", () => {
    it("should add writeable page and set data separately", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const data = new Uint8Array(PAGE_SIZE).fill(1);
      const pageNumber = tryAsPageNumber(RESERVED_NUMBER_OF_PAGES);
      const address = tryAsMemoryIndex(pageNumber * PAGE_SIZE);
      pageMap.set(pageNumber, new WriteablePage(pageNumber, data));
      const expectedMemory = {
        endHeapIndex: (RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE,
        sbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        virtualSbrkIndex: (RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(
          tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE),
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 1) * PAGE_SIZE),
        )
        .setData(address, data)
        .finalize(
          tryAsMemoryIndex((RESERVED_NUMBER_OF_PAGES + 2) * PAGE_SIZE),
          tryAsSbrkIndex((RESERVED_NUMBER_OF_PAGES + 4) * PAGE_SIZE),
        );

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
