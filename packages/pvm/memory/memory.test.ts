import assert from "node:assert";
import { describe, it } from "node:test";

import { PageFault } from "./errors";
import { Memory } from "./memory";
import { PAGE_SIZE } from "./memory-consts";
import { createMemoryIndex } from "./memory-index";
import { type PageNumber, createPageNumber } from "./page-number";
import { ReadablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";

describe("Memory", () => {
  describe("loadInto", () => {
    it("should return PageFault if the page does not exist", () => {
      const memory = new Memory();
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(1);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, new PageFault(addressToLoad));
    });

    it("should correctly load data from one page", () => {
      const startPageIndex = createMemoryIndex(0);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const page = new ReadablePage(startPageIndex, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), page);
      const memory = new Memory(memoryMap);
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(1);
      const expectedResult = bytes.subarray(addressToLoad, addressToLoad + lengthToLoad);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should correctly load data from two pages", () => {
      const firstStartPageIndex = createMemoryIndex(0);
      const secondStartPageIndex = createMemoryIndex(PAGE_SIZE);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const firstPage = new ReadablePage(
        firstStartPageIndex,
        new Uint8Array([...new Uint8Array(PAGE_SIZE - bytes.length), ...bytes]),
      );
      const secondPage = new ReadablePage(secondStartPageIndex, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), firstPage);
      memoryMap.set(createPageNumber(1), secondPage);
      const memory = new Memory(memoryMap);
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(PAGE_SIZE - 2);
      const expectedResult = new Uint8Array([4, 5, 1, 2]);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should return PageFault if case of loading data from 2 pages but one of them does not exist", () => {
      const startPageIndex = createMemoryIndex(0);
      const bytes = new Uint8Array();
      const page = new ReadablePage(startPageIndex, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), page);
      const memory = new Memory(memoryMap);
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(PAGE_SIZE - 2);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, new PageFault(PAGE_SIZE));
    });
  });

  describe("storeFrom", () => {
    it("should return PageFault if the page does not exist", () => {
      const memory = new Memory();
      const addressToStore = createMemoryIndex(1);

      const storeResult = memory.storeFrom(addressToStore, new Uint8Array());

      assert.deepStrictEqual(storeResult, new PageFault(addressToStore));
    });

    it("should correctly store data on one page", () => {});

    it("should correctly store data on two pages", () => {});

    it("should return PageFault if case of storing data on 2 pages but one of them does not exist", () => {});
  });

  describe("sbrk", () => {});
});
