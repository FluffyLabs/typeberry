import assert from "node:assert";
import { describe, it } from "node:test";

import { PageFault } from "./errors";
import { Memory } from "./memory";
import { MAX_MEMORY_INDEX, MIN_ALLOCATION_LENGTH, PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "./memory-consts";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "./memory-index";
import { ReadablePage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, tryAsPageNumber } from "./pages/page-utils";

describe("Memory", () => {
  describe("loadInto", () => {
    it("should return PageFault if the page does not exist", () => {
      const memory = new Memory();
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);

      const loadResult = memory.loadInto(result, addressToLoad);

      assert.deepStrictEqual(loadResult, PageFault.fromMemoryIndex(addressToLoad));
    });

    it("should correctly load data from one page", () => {
      const pageNumber = tryAsPageNumber(16);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const page = new ReadablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(pageNumber, page);
      const sbrkIndex = tryAsSbrkIndex(20 * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const expectedResult = bytes.subarray(addressToLoad % PAGE_SIZE, (addressToLoad % PAGE_SIZE) + lengthToLoad);

      const loadResult = memory.loadInto(result, addressToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should correctly load data from two pages", () => {
      const firstPageNumber = tryAsPageNumber(16);
      const secondPageNumber = tryAsPageNumber(17);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const firstPage = new ReadablePage(
        firstPageNumber,
        new Uint8Array([...new Uint8Array(PAGE_SIZE - bytes.length), ...bytes]),
      );
      const secondPage = new ReadablePage(secondPageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(firstPageNumber, firstPage);
      memoryMap.set(secondPageNumber, secondPage);
      const sbrkIndex = tryAsSbrkIndex(20 * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = tryAsMemoryIndex(secondPageNumber * PAGE_SIZE - 2);
      const expectedResult = new Uint8Array([4, 5, 1, 2]);

      const loadResult = memory.loadInto(result, addressToLoad);

      assert.deepStrictEqual(loadResult, null);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should return PageFault if case of loading data from 2 pages but one of them does not exist", () => {
      const pageNumber = tryAsPageNumber(16);
      const bytes = new Uint8Array();
      const page = new ReadablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(pageNumber, page);
      const sbrkIndex = tryAsSbrkIndex(0);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = tryAsMemoryIndex(17 * PAGE_SIZE - 2);

      const loadResult = memory.loadInto(result, addressToLoad);

      assert.deepStrictEqual(loadResult, PageFault.fromPageNumber(17));
    });

    it("should return fault when load data from the last page and the first page", () => {
      const firstPageNumber = tryAsPageNumber((MAX_MEMORY_INDEX - PAGE_SIZE + 1) / PAGE_SIZE);
      const secondPageNumber = tryAsPageNumber(0);
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const firstPage = new ReadablePage(
        firstPageNumber,
        new Uint8Array([...new Uint8Array(PAGE_SIZE - bytes.length), ...bytes]),
      );
      const secondPage = new ReadablePage(
        secondPageNumber,
        new Uint8Array([...bytes, ...new Uint8Array(PAGE_SIZE - bytes.length)]),
      );
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(firstPageNumber, firstPage);
      memoryMap.set(secondPageNumber, secondPage);
      const sbrkIndex = tryAsSbrkIndex(20 * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(30 * PAGE_SIZE);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const lengthToLoad = 4;
      const result = new Uint8Array(lengthToLoad);
      const addressToLoad = tryAsMemoryIndex(MAX_MEMORY_INDEX - 1);
      const expectedResult = new Uint8Array(lengthToLoad);

      const loadResult = memory.loadInto(result, addressToLoad);

      assert.deepStrictEqual(loadResult, PageFault.fromPageNumber(0, true));
      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe("storeFrom", () => {
    it("should return PageFault if the page does not exist", () => {
      const memory = new Memory();
      const addressToStore = tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE + 1);
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const storeResult = memory.storeFrom(addressToStore, dataToStore);

      assert.deepStrictEqual(storeResult, PageFault.fromMemoryIndex(addressToStore));
    });

    it("should not return PageFault if the page does not exist and stored array length is 0 (standard page)", () => {
      const memory = new Memory();
      const addressToStore = tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE + 1);

      const storeResult = memory.storeFrom(addressToStore, new Uint8Array());

      assert.deepStrictEqual(storeResult, null);
    });

    it("should not return PageFault if the page does not exist and stored array length is 0 - even it is a reserved page", () => {
      const memory = new Memory();
      const addressToStore = tryAsMemoryIndex(1);

      const storeResult = memory.storeFrom(addressToStore, new Uint8Array());

      assert.deepStrictEqual(storeResult, null);
    });

    it("should correctly store data on one page", () => {
      const pageNumber = tryAsPageNumber(16);
      const page = new WriteablePage(pageNumber, new Uint8Array());
      const memoryMap = new Map<PageNumber, MemoryPage>();
      const sbrkIndex = tryAsSbrkIndex(20 * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      memoryMap.set(pageNumber, page);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const addressToStore = tryAsMemoryIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE + 1);
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
      const firstPageNumber = tryAsPageNumber(16);
      const secondPageNumber = tryAsPageNumber(17);
      const firstPage = new WriteablePage(firstPageNumber, new Uint8Array(PAGE_SIZE));
      const secondPage = new WriteablePage(secondPageNumber, new Uint8Array());
      const memoryMap = new Map<PageNumber, MemoryPage>();
      const sbrkIndex = tryAsSbrkIndex(20 * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      memoryMap.set(firstPageNumber, firstPage);
      memoryMap.set(secondPageNumber, secondPage);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const addressToStore = tryAsMemoryIndex(17 * PAGE_SIZE - 2);
      const expectedMemoryMap = new Map();
      expectedMemoryMap.set(
        firstPageNumber,
        new WriteablePage(firstPageNumber, new Uint8Array([...new Uint8Array(PAGE_SIZE - 2), 1, 2])),
      );
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(secondPageNumber, new Uint8Array([3, 4, ...new Uint8Array(MIN_ALLOCATION_LENGTH - 2)])),
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
      const pageNumber = tryAsPageNumber(16);
      const bytes = new Uint8Array();
      const page = new WriteablePage(pageNumber, bytes);
      const memoryMap = new Map<PageNumber, MemoryPage>();
      memoryMap.set(pageNumber, page);
      const sbrkIndex = tryAsSbrkIndex(RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const addressToStore = tryAsMemoryIndex(17 * PAGE_SIZE - 2);

      const storeResult = memory.storeFrom(addressToStore, new Uint8Array(4));

      assert.deepStrictEqual(storeResult, PageFault.fromPageNumber(17));
    });

    it("should return fault when store data on two pages - the last page and the first page", () => {
      const firstPageNumber = tryAsPageNumber((MAX_MEMORY_INDEX - PAGE_SIZE + 1) / PAGE_SIZE);
      const secondPageNumber = tryAsPageNumber(0);
      const firstPage = new WriteablePage(firstPageNumber, new Uint8Array(PAGE_SIZE));
      const secondPage = new WriteablePage(secondPageNumber, new Uint8Array(PAGE_SIZE));
      const memoryMap = new Map<PageNumber, MemoryPage>();
      const sbrkIndex = tryAsSbrkIndex(0);
      const endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
      memoryMap.set(firstPageNumber, firstPage);
      memoryMap.set(secondPageNumber, secondPage);
      const memory = Memory.fromInitialMemory({ memory: memoryMap, sbrkIndex, endHeapIndex });
      const dataToStore = new Uint8Array([1, 2, 3, 4]);
      const addressToStore = tryAsMemoryIndex(MAX_MEMORY_INDEX - 2);
      const expectedMemoryMap = new Map();
      expectedMemoryMap.set(firstPageNumber, new WriteablePage(firstPageNumber, new Uint8Array(PAGE_SIZE)));
      expectedMemoryMap.set(secondPageNumber, new WriteablePage(secondPageNumber, new Uint8Array(PAGE_SIZE)));

      const expectedMemory = {
        sbrkIndex,
        virtualSbrkIndex: sbrkIndex,
        endHeapIndex,
        memory: expectedMemoryMap,
      };

      const storeResult = memory.storeFrom(addressToStore, dataToStore);

      assert.deepStrictEqual(storeResult, PageFault.fromPageNumber(0, true));
      assert.deepEqual(memory, expectedMemory);
    });
  });

  describe("sbrk", () => {
    it("should allocate one page", () => {
      const memory = new Memory();
      const lengthToAllocate = 5;
      const expectedMemoryMap = new Map();
      const pageNumber = tryAsPageNumber(0);

      expectedMemoryMap.set(pageNumber, new WriteablePage(pageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));

      const expectedMemory = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MAX_MEMORY_INDEX,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });

    it("should allocate two pages", () => {
      const memory = new Memory();
      const lengthToAllocate = PAGE_SIZE + 5;
      const expectedMemoryMap = new Map();
      const firstPageNumber = tryAsPageNumber(0);
      const secondPageNumber = tryAsPageNumber(1);

      expectedMemoryMap.set(firstPageNumber, new WriteablePage(firstPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(secondPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)),
      );

      const expectedMemory = {
        sbrkIndex: 2 * PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MAX_MEMORY_INDEX,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });

    it("should not allocate if virtualSbrkIndex + length < sbrkIndex", () => {
      const memory = new Memory();
      const lengthToAllocate = 5;
      const expectedMemoryMap = new Map();
      const pageNumber = tryAsPageNumber(0);

      expectedMemoryMap.set(pageNumber, new WriteablePage(pageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));

      const expectedMemoryAfterFirstAllocation = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: lengthToAllocate,
        endHeapIndex: MAX_MEMORY_INDEX,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemoryAfterFirstAllocation);

      const expectedMemoryAfterSecondAllocation = {
        sbrkIndex: PAGE_SIZE,
        virtualSbrkIndex: 2 * lengthToAllocate,
        endHeapIndex: MAX_MEMORY_INDEX,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemoryAfterSecondAllocation);
    });

    it("should allocate two pages one by one", () => {
      const memory = new Memory();
      const lengthToAllocate = PAGE_SIZE;
      const expectedMemoryMap = new Map();
      const firstPageNumber = tryAsPageNumber(0);
      const secondPageNumber = tryAsPageNumber(1);

      expectedMemoryMap.set(firstPageNumber, new WriteablePage(firstPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)));
      expectedMemoryMap.set(
        secondPageNumber,
        new WriteablePage(secondPageNumber, new Uint8Array(MIN_ALLOCATION_LENGTH)),
      );

      const expectedMemory = {
        sbrkIndex: 2 * PAGE_SIZE,
        virtualSbrkIndex: 2 * PAGE_SIZE,
        endHeapIndex: MAX_MEMORY_INDEX,
        memory: expectedMemoryMap,
      };

      memory.sbrk(lengthToAllocate);
      memory.sbrk(lengthToAllocate);

      assert.deepEqual(memory, expectedMemory);
    });
  });

  describe("isWriteable", () => {
    it('should return true for length 0 "slices"', () => {
      const memory = new Memory();
      const addressToStore = tryAsMemoryIndex(1);
      const length = 0;

      const isWriteable = memory.isWriteable(addressToStore, length);
      assert.strictEqual(isWriteable, true);
    });
  });
});
