import assert from "node:assert";
import { describe, it } from "node:test";

import { PageFault } from "./errors";
import { Memory } from "./memory";
import { MEMORY_SIZE, MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "./memory-consts";
import { createMemoryIndex } from "./memory-index";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, createPageNumber } from "./pages/page-utils";
import { writeable } from "./pages/virtual-page";

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
      const pageNumber = createPageNumber(0);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const page = new ReadablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), page);
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(1);
      const expectedResult = bytes.subarray(addressToLoad, addressToLoad + lengthToLoad);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should correctly load data from two pages", () => {
      const firstPageNumber = createPageNumber(0);
      const secondPageNumber = createPageNumber(1);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const firstPage = new ReadablePage(
        firstPageNumber,
        new Uint8Array([...new Uint8Array(PAGE_SIZE - bytes.length), ...bytes]),
      );
      const secondPage = new ReadablePage(secondPageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), firstPage);
      memoryMap.set(createPageNumber(1), secondPage);
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = createMemoryIndex(PAGE_SIZE - 2);
      const expectedResult = new Uint8Array([4, 5, 1, 2]);

      const loadResult = memory.loadInto(result, addressToLoad, lengthToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should return PageFault if case of loading data from 2 pages but one of them does not exist", () => {
      const pageNumber = createPageNumber(0);
      const bytes = new Uint8Array();
      const page = new ReadablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), page);
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
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

    it("should correctly store data on one page", () => {
      const pageNumber = createPageNumber(0);
      const page = new WriteablePage(pageNumber, new Uint8Array());
      const memoryMap = new Map<PageNumber, MemoryPage>();
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      memoryMap.set(pageNumber, page);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const addressToStore = createMemoryIndex(1);
      const expectedMemoryMap = new Map();
      expectedMemoryMap.set(
        pageNumber,
        new WriteablePage(
          pageNumber,
          new Uint8Array([0, ...dataToStore, ...new Uint8Array(MIN_ALLOCATION_LENGTH - dataToStore.length - 1)]),
        ),
      );
      const expectedMemory = {
        sbrkIndex,
        virtualSbrkIndex: sbrkIndex,
        endHeapIndex,
        memory: expectedMemoryMap,
      };

      const storeResult = memory.storeFrom(addressToStore, dataToStore);

      assert.deepStrictEqual(storeResult, null);
      assert.deepEqual(memory, expectedMemory);
    });

    it("should correctly store data on two pages", () => {
      const pageNumber = createPageNumber(0);
      const firstPage = new WriteablePage(pageNumber, new Uint8Array(PAGE_SIZE));
      const secondPage = new WriteablePage(pageNumber, new Uint8Array());
      const memoryMap = new Map<PageNumber, MemoryPage>();
      const firstPageNumber = createPageNumber(0);
      const secondPageNumber = createPageNumber(1);
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      memoryMap.set(firstPageNumber, firstPage);
      memoryMap.set(secondPageNumber, secondPage);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const addressToStore = createMemoryIndex(PAGE_SIZE - 2);
      const expectedMemoryMap = new Map();
      expectedMemoryMap.set(
        firstPageNumber,
        new WriteablePage(pageNumber, new Uint8Array([...new Uint8Array(PAGE_SIZE - 2), 1, 2])),
      );
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(pageNumber, new Uint8Array([3, 4, ...new Uint8Array(MIN_ALLOCATION_LENGTH - 2)])),
      );

      const expectedMemory = {
        sbrkIndex,
        virtualSbrkIndex: sbrkIndex,
        endHeapIndex,
        memory: expectedMemoryMap,
      };
      const storeResult = memory.storeFrom(addressToStore, dataToStore);

      assert.deepStrictEqual(storeResult, null);
      assert.deepEqual(memory, expectedMemory);
    });

    it("should return PageFault if case of storing data on 2 pages but one of them does not exist", () => {
      const pageNumber = createPageNumber(0);
      const bytes = new Uint8Array();
      const page = new ReadablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(createPageNumber(0), page);
      const sbrkIndex = createMemoryIndex(0);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const addressToStore = createMemoryIndex(PAGE_SIZE - 2);

      const storeResult = memory.storeFrom(addressToStore, new Uint8Array(4));

      assert.deepStrictEqual(storeResult, new PageFault(PAGE_SIZE));
    });
  });

  describe("sbrk", () => {
    it("should allocate one page", () => {
      const memory = new Memory();
      const lengthToAllocate = 5;
      const expectedMemoryMap = new Map();
      const pageNumber = createPageNumber(0);

      expectedMemoryMap.set(pageNumber, new WriteablePage(pageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));

      const expectedMemory = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });

    it("should allocate two pages", () => {
      const memory = new Memory();
      const lengthToAllocate = PAGE_SIZE + 5;
      const expectedMemoryMap = new Map();
      const firstPageNumber = createPageNumber(0);
      const secondPageNumber = createPageNumber(1);

      expectedMemoryMap.set(firstPageNumber, new WriteablePage(firstPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(secondPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)),
      );

      const expectedMemory = {
        sbrkIndex: 2 * PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });

    it("should not allocate if virtualSbrkIndex + length < sbrkIndex", () => {
      const memory = new Memory();
      const lengthToAllocate = 5;
      const expectedMemoryMap = new Map();
      const pageNumber = createPageNumber(0);

      expectedMemoryMap.set(pageNumber, new WriteablePage(pageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));

      const expectedMemoryAfterFirstAllocation = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemoryAfterFirstAllocation);

      const expectedMemoryAfterSecondAllocation = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: 2 * lengthToAllocate,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemoryAfterSecondAllocation);
    });

    it("should allocate chunk on virtual page", () => {
      const startPageIndex = createMemoryIndex(0);
      const endPageIndex = createMemoryIndex(50);
      const pageNumber = createPageNumber(0);
      const page = new VirtualPage(pageNumber);
      const initialChunk = [startPageIndex, endPageIndex, new Uint8Array(), writeable] as const;
      page.set(...initialChunk);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(pageNumber, page);
      const sbrkIndex = createMemoryIndex(endPageIndex);
      const endHeapIndex = createMemoryIndex(MEMORY_SIZE);
      const memory = new Memory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToAllocate = 5;
      const expectedMemoryMap = new Map();
      const expectedPage = new VirtualPage(pageNumber);
      expectedMemoryMap.set(pageNumber, expectedPage);
      expectedPage.set(...initialChunk);
      expectedPage.set(endPageIndex, createMemoryIndex(PAGE_SIZE), new Uint8Array(PAGE_SIZE - endPageIndex), writeable);

      const expectedMemory = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: endPageIndex + lengthToAllocate,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });

    it("should allocate two pages one by one", () => {
      const memory = new Memory();
      const lengthToAllocate = PAGE_SIZE;
      const expectedMemoryMap = new Map();
      const firstPageNumber = createPageNumber(0);
      const secondPageNumber = createPageNumber(1);

      expectedMemoryMap.set(firstPageNumber, new WriteablePage(firstPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(secondPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)),
      );

      const expectedMemory = {
        sbrkIndex: 2 * PAGE_SIZE,
        virtualSbrkIndex: 2 * PAGE_SIZE,
        endHeapIndex: MEMORY_SIZE,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);
      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });
  });
});
