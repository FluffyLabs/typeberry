import { PageFault } from "./errors";
import { MAX_MEMORY_INDEX, MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { alignToPageSize, getPageNumber, getStartPageIndexFromPageNumber } from "./memory-utils";
import { WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, createPageIndex, getNextPageNumber } from "./pages/page-utils";

type InitialMemoryState = {
  memory: Map<PageNumber, MemoryPage>;
  sbrkIndex: MemoryIndex;
  endHeapIndex: MemoryIndex;
};

export class Memory {
  static fromInitialMemory(initialMemoryState: InitialMemoryState) {
    return new Memory(
      initialMemoryState?.sbrkIndex,
      initialMemoryState?.sbrkIndex,
      initialMemoryState?.endHeapIndex,
      initialMemoryState?.memory,
    );
  }

  constructor(
    private sbrkIndex = createMemoryIndex(0),
    private virtualSbrkIndex = createMemoryIndex(0),
    private endHeapIndex = createMemoryIndex(MAX_MEMORY_INDEX),
    private memory = new Map<PageNumber, MemoryPage>(),
  ) {}

  reset() {
    this.sbrkIndex = createMemoryIndex(0);
    this.virtualSbrkIndex = createMemoryIndex(0);
    this.endHeapIndex = createMemoryIndex(MAX_MEMORY_INDEX);
    this.memory = new Map<PageNumber, MemoryPage>(); // TODO [MaSi]: We should keep allocated pages somewhere and reuse it when it is possible
  }

  copyFrom(memory: Memory) {
    this.sbrkIndex = memory.sbrkIndex;
    this.virtualSbrkIndex = memory.virtualSbrkIndex;
    this.endHeapIndex = memory.endHeapIndex;
    this.memory = memory.memory;
  }

  // TODO [ToDr] This should support writing to more than two pages.
  storeFrom(address: MemoryIndex, bytes: Uint8Array) {
    const pageNumber = getPageNumber(address);
    const page = this.memory.get(pageNumber);
    if (!page) {
      return new PageFault(address);
    }

    if (address >= this.virtualSbrkIndex && address < this.sbrkIndex) {
      // the range [virtualSbrkIndex; sbrkIndex) is allocated but shouldn't be available yet
      return new PageFault(address);
    }

    const firstPageIndex = createPageIndex(address - page.start);
    const pageEnd = page.start + PAGE_SIZE;

    if (address + bytes.length <= pageEnd) {
      return page.storeFrom(firstPageIndex, bytes);
    }

    // bytes span two pages, so we need to split it and store separately.
    const toStoreOnFirstPage = address + bytes.length - pageEnd;
    const toStoreOnSecondPage = bytes.length - toStoreOnFirstPage;
    // secondPageNumber will be 0 if pageNumber is the last page
    const secondPageNumber = getNextPageNumber(pageNumber);
    const secondPage = this.memory.get(secondPageNumber);

    if (!secondPage) {
      return new PageFault(pageEnd);
    }

    const firstPageStoreResult = page.storeFrom(firstPageIndex, bytes.subarray(0, toStoreOnFirstPage));

    if (firstPageStoreResult !== null) {
      return firstPageStoreResult;
    }

    return secondPage.storeFrom(
      createPageIndex(0),
      bytes.subarray(toStoreOnFirstPage, toStoreOnFirstPage + toStoreOnSecondPage),
    );
  }

  /**
   * Read content of the memory at `[address, address + result.length)` and
   * write the result into the `result` buffer.
   *
   * Returns `null` if the data was read successfuly or `PageFault` otherwise.
   * NOTE That the `result` might be partially modified in case `PageFault` occurs!
   */
  loadInto(result: Uint8Array, startAddress: MemoryIndex): null | PageFault {
    if (startAddress >= this.virtualSbrkIndex && startAddress < this.sbrkIndex) {
      // [virtualSbrkIndex; sbrkIndex) is allocated but shouldn't be available before sbrk is called
      return new PageFault(startAddress);
    }

    const pageIndexZero = createPageIndex(0);

    const wrappedEndAddress = (startAddress + result.length) % MEMORY_SIZE;
    const lastPage = getPageNumber(createMemoryIndex(wrappedEndAddress));
    const endAddressOnPage = wrappedEndAddress % PAGE_SIZE;
    const pageAfterLast = getNextPageNumber(lastPage);

    let resultOffset = 0;
    let currentPage = getPageNumber(startAddress);
    let pageOffset = createPageIndex(startAddress - getStartPageIndexFromPageNumber(currentPage));

    while (currentPage !== pageAfterLast) {
      const page = this.memory.get(currentPage);
      if (!page) {
        return new PageFault(pageOffset + getStartPageIndexFromPageNumber(currentPage));
      }

      // for full pages we will want to read up to `PAGE_SIZE`, but
      // we have an edge case for the last page.
      const end = currentPage === lastPage ? endAddressOnPage : PAGE_SIZE;
      const len = end - pageOffset;

      // load the result and move the result offset
      const res = page.loadInto(result.subarray(resultOffset), pageOffset, len);
      resultOffset += len;
      if (res !== null) {
        return res;
      }

      // jump to the next page (we might wrap) and reset the page offset
      currentPage = getNextPageNumber(currentPage);
      pageOffset = pageIndexZero;
    }

    return null;
  }

  sbrk(length: number): MemoryIndex {
    const currentSbrkIndex = this.sbrkIndex;
    const currentVirtualSbrkIndex = this.virtualSbrkIndex;

    // new index is bigger than 2 ** 32 or endHeapIndex
    if (MAX_MEMORY_INDEX - length >= currentVirtualSbrkIndex || currentVirtualSbrkIndex + length >= this.endHeapIndex) {
      // OoM but idk how to handle it
    }

    const newVirtualSbrkIndex = createMemoryIndex(this.virtualSbrkIndex + length);

    // no alllocation needed
    if (newVirtualSbrkIndex <= currentSbrkIndex) {
      this.virtualSbrkIndex = newVirtualSbrkIndex;
      return currentVirtualSbrkIndex;
    }

    // standard allocation using "Writeable" pages
    const newSbrkIndex = createMemoryIndex(alignToPageSize(this.sbrkIndex + length));
    const pagesToAllocate = (newSbrkIndex - currentSbrkIndex) / PAGE_SIZE;

    for (let i = 0; i < pagesToAllocate; i++) {
      const startMemoryIndex = createMemoryIndex(currentSbrkIndex + i * PAGE_SIZE);
      const pageNumber = getPageNumber(startMemoryIndex);
      const page = new WriteablePage(pageNumber);
      this.memory.set(pageNumber, page);
    }

    this.virtualSbrkIndex = createMemoryIndex(currentSbrkIndex + length);
    this.sbrkIndex = newSbrkIndex;
    return currentSbrkIndex;
  }

  getPageDump(pageNumber: PageNumber) {
    const page = this.memory.get(pageNumber);
    return page?.getPageDump() ?? null;
  }

  getDirtyPages() {
    return this.memory.keys();
  }
}
