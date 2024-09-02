import assert from "node:assert";
import { describe, it } from "node:test";
import { IncorrectSbrkIndex, PageOverride } from "./errors";
import { MemoryBuilder } from "./memory-builder";
import { PAGE_SIZE } from "./memory-consts";
import { createMemoryIndex } from "./memory-index";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import { readable, writeable } from "./pages/virtual-page";

describe("MemoryBuilder", () => {
  describe("finalize", () => {
    it("should work correctly (happy path)", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(createMemoryIndex(0));
      vp.set(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array(), readable);
      vp.set(createMemoryIndex(1), createMemoryIndex(2), new Uint8Array(), writeable);
      pageMap.set(0, vp);
      pageMap.set(1, new ReadablePage(createMemoryIndex(PAGE_SIZE), new Uint8Array()));
      pageMap.set(2, new WriteablePage(createMemoryIndex(2 * PAGE_SIZE), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadable(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array())
        .setWriteable(createMemoryIndex(1), createMemoryIndex(2), new Uint8Array())
        .setReadablePages(createMemoryIndex(PAGE_SIZE), createMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(createMemoryIndex(2 * PAGE_SIZE), createMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw IncorrectSbrkIndex exception when some page are in heap segment", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadable(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array())
          .setWriteable(createMemoryIndex(1), createMemoryIndex(2), new Uint8Array())
          .setReadablePages(createMemoryIndex(PAGE_SIZE), createMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
          .setWriteablePages(createMemoryIndex(2 * PAGE_SIZE), createMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
          .finalize(createMemoryIndex(0), createMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new IncorrectSbrkIndex());
    });
  });

  describe("chunked memory", () => {
    it("should correctly add readable chunk on virtual page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(createMemoryIndex(0));
      vp.set(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array(), readable);
      pageMap.set(0, vp);
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadable(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw PageOverride exception when setReadable tries to override other Page", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(createMemoryIndex(0), createMemoryIndex(PAGE_SIZE), new Uint8Array())
          .setReadable(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array())
          .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new PageOverride());
    });

    it("should correctly add writeable chunk on virtual page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      const vp = new VirtualPage(createMemoryIndex(0));
      vp.set(createMemoryIndex(1), createMemoryIndex(2), new Uint8Array(), writeable);
      pageMap.set(0, vp);
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteable(createMemoryIndex(1), createMemoryIndex(2), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should throw PageOverride exception when setWriteable tries to override other Page", () => {
      const builder = new MemoryBuilder();

      const tryToBuildMemory = () =>
        builder
          .setReadablePages(createMemoryIndex(0), createMemoryIndex(PAGE_SIZE), new Uint8Array())
          .setWriteable(createMemoryIndex(0), createMemoryIndex(1), new Uint8Array())
          .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.throws(tryToBuildMemory, new PageOverride());
    });
  });

  describe("paged memory", () => {
    it("should add readable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(1, new ReadablePage(createMemoryIndex(PAGE_SIZE), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(createMemoryIndex(PAGE_SIZE), createMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add writeable page", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(2, new WriteablePage(createMemoryIndex(2 * PAGE_SIZE), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setWriteablePages(createMemoryIndex(2 * PAGE_SIZE), createMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });

    it("should add two pages", () => {
      const builder = new MemoryBuilder();
      const pageMap = new Map();
      pageMap.set(1, new ReadablePage(createMemoryIndex(PAGE_SIZE), new Uint8Array()));
      pageMap.set(2, new WriteablePage(createMemoryIndex(2 * PAGE_SIZE), new Uint8Array()));
      const expectedMemory = {
        endHeapIndex: 4 * PAGE_SIZE,
        sbrkIndex: 3 * PAGE_SIZE,
        virtualSbrkIndex: 3 * PAGE_SIZE,
        memory: pageMap,
      };

      const memory = builder
        .setReadablePages(createMemoryIndex(PAGE_SIZE), createMemoryIndex(2 * PAGE_SIZE), new Uint8Array())
        .setWriteablePages(createMemoryIndex(2 * PAGE_SIZE), createMemoryIndex(3 * PAGE_SIZE), new Uint8Array())
        .finalize(createMemoryIndex(3 * PAGE_SIZE), createMemoryIndex(4 * PAGE_SIZE));

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
