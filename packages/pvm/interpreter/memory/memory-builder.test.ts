import assert from "node:assert";
import { describe, it } from "node:test";
import { IncorrectSbrkIndex, PageOverride } from "./errors";
import { MemoryBuilder } from "./memory-builder";
import { PAGE_SIZE } from "./memory-consts";
import { tryAsMemoryIndex } from "./memory-index";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import { tryAsPageIndex, tryAsPageNumber } from "./pages/page-utils";
import { createEndChunkIndex, readable, writeable } from "./pages/virtual-page";

describe("MemoryBuilder", () => {
  describe("finalize", () => {
    it("should work correctly (happy path)", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(tryAsPageNumber(0));
      vp.set(tryAsPageIndex(0), createEndChunkIndex(1), new Uint8Array(), readable);
      vp.set(tryAsPageIndex(1), createEndChunkIndex(2), new Uint8Array(), writeable);
      pageMap.set(0, vp);
      pageMap.set(1, new ReadablePage(tryAsPageNumber(1), new Uint8Array()));
      pageMap.set(2, new WriteablePage(tryAsPageNumber(2), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadable(tryAsMemoryIndex(0), tryAsMemoryIndex(1), new Uint8Array())
        .setWriteable(tryAsMemoryIndex(1), tryAsMemoryIndex(2), new Uint8Array())
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw IncorrectSbrkIndex exception when some page are in heap segment", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadable(tryAsMemoryIndex(0), tryAsMemoryIndex(1), new Uint8Array())
          .setWriteable(tryAsMemoryIndex(1), tryAsMemoryIndex(2), new Uint8Array())
          .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
          .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
          .finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });

    it("should throw IncorrectSbrkIndex exception when sbrk index is on virtual page", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setWriteable(tryAsMemoryIndex(1), tryAsMemoryIndex(50), new Uint8Array())
          .finalize(tryAsMemoryIndex(50), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });
  });

  describe("chunked memory", () => {
    it("should correctly add readable chunk on virtual page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(tryAsPageNumber(0));
      vp.set(tryAsPageIndex(0), createEndChunkIndex(1), new Uint8Array(), readable);
      pageMap.set(0, vp);
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadable(tryAsMemoryIndex(0), tryAsMemoryIndex(1), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw PageOverride exception when setReadable tries to override other Page", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(tryAsMemoryIndex(0), tryAsMemoryIndex(PAGE_SIZE), new Uint8Array())
          .setReadable(tryAsMemoryIndex(0), tryAsMemoryIndex(1), new Uint8Array())
          .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new PageOverride());
    });

    it("should correctly add writeable chunk on virtual page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(tryAsPageNumber(0));
      vp.set(tryAsPageIndex(1), createEndChunkIndex(2), new Uint8Array(), writeable);
      pageMap.set(0, vp);
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteable(tryAsMemoryIndex(1), tryAsMemoryIndex(2), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw PageOverride exception when setWriteable tries to override other Page", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(tryAsMemoryIndex(0), tryAsMemoryIndex(PAGE_SIZE), new Uint8Array())
          .setWriteable(tryAsMemoryIndex(0), tryAsMemoryIndex(1), new Uint8Array())
          .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new PageOverride());
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
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add writeable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(2, new WriteablePage(tryAsPageNumber(2), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

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
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(tryAsMemoryIndex(2 * PAGE_SIZE), tryAsMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(tryAsMemoryIndex(3 * PAGE_SIZE), tryAsMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
