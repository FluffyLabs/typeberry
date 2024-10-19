import { PageFault } from "./errors";
import { MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { alignToPageSize, getPageNumber } from "./memory-utils";
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
    private endHeapIndex = createMemoryIndex(MEMORY_SIZE),
    private memory = new Map<PageNumber, MemoryPage>(),
  ) {}

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

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 4) {
    const pageNumber = getPageNumber(address);
    const page = this.memory.get(pageNumber);
    if (!page) {
      return new PageFault(address);
    }

    if (address >= this.virtualSbrkIndex && address < this.sbrkIndex) {
      // [virtualSbrkIndex; sbrkIndex) is allocated but shouldn't be available before sbrk is called
      return new PageFault(address);
    }

    const firstPageIndex = createPageIndex(address - page.start);
    const pageEnd = page.start + PAGE_SIZE;

    if (address + length <= pageEnd) {
      return page.loadInto(result, firstPageIndex, length);
    }

    // bytes span two pages, so we need to split it and load separately.
    const toReadFromFirstPage = address + length - pageEnd;
    const toReadFromSecondPage = length - toReadFromFirstPage;
    // secondPageNumber will be 0 if pageNumber is the last page
    const secondPageNumber = getNextPageNumber(pageNumber);
    const secondPage = this.memory.get(secondPageNumber);
    if (!secondPage) {
      return new PageFault(pageEnd);
    }

    const firstPageLoadResult = page.loadInto(
      result.subarray(0, toReadFromFirstPage),
      firstPageIndex,
      toReadFromFirstPage,
    );

    if (firstPageLoadResult !== null) {
      return firstPageLoadResult;
    }

    return secondPage.loadInto(result.subarray(toReadFromFirstPage), createPageIndex(0), toReadFromSecondPage);
  }

  sbrk(length: number): MemoryIndex {
    const currentSbrkIndex = this.sbrkIndex;
    const currentVirtualSbrkIndex = this.virtualSbrkIndex;

    // new index is bigger than 2 ** 32 or endHeapIndex
    if (MEMORY_SIZE - length >= currentVirtualSbrkIndex || currentVirtualSbrkIndex + length >= this.endHeapIndex) {
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
