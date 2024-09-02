import { PageFault } from "./errors";
import { MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { alignToPageSize, getPageNumber } from "./memory-utils";
import { type PageNumber, createPageNumber } from "./page-number";
import { VirtualPage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";

export class Memory {
  sbrkIndex = createMemoryIndex(0);
  virtualSbrkIndex = createMemoryIndex(0);
  endHeap = createMemoryIndex(MEMORY_SIZE);

  constructor(private memory: Map<PageNumber, MemoryPage> = new Map()) {}

  setSbrkIndex(index: MemoryIndex, endHeap: MemoryIndex) {
    this.sbrkIndex = index;
    this.virtualSbrkIndex = index;
    this.endHeap = endHeap;
  }

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

    const pageEnd = page.start + PAGE_SIZE;

    if (address + bytes.length > pageEnd) {
      const toStoreOnFirstPage = address + bytes.length - pageEnd;
      const toStoreOnSecondPage = bytes.length - toStoreOnFirstPage;
      const secondPageNumber = createPageNumber(pageNumber + 1);
      const secondPage = this.memory.get(secondPageNumber);
      if (!secondPage) {
        return new PageFault(pageEnd);
      }
      const firstPageStoreResult = page.storeFrom(address, bytes.subarray(0, toStoreOnFirstPage));
      if (firstPageStoreResult !== null) {
        return firstPageStoreResult;
      }
      return secondPage.storeFrom(
        secondPage.start,
        bytes.subarray(toStoreOnFirstPage, toStoreOnFirstPage + toStoreOnSecondPage),
      );
    }
    return page.storeFrom(address, bytes);
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

    const pageEnd = page.start + PAGE_SIZE;

    if (address + length > pageEnd) {
      const toReadFromFirstPage = address + length - pageEnd;
      const toReadFromSecondPage = length - toReadFromFirstPage;
      const secondPageNumber = createPageNumber(pageNumber + 1);
      const secondPage = this.memory.get(secondPageNumber);
      if (!secondPage) {
        return new PageFault(pageEnd);
      }
      page.loadInto(result.subarray(0, toReadFromFirstPage), address, toReadFromFirstPage);
      secondPage.loadInto(result.subarray(toReadFromFirstPage), secondPage.start, toReadFromSecondPage);
    } else {
      page.loadInto(result, address, length);
    }

    return null;
  }

  sbrk(length: number): MemoryIndex {
    // TODO: check if length + sbrkInddex < initialSbrkIndex + maxHeap
    const currentSbrkIndex = this.sbrkIndex;
    const currentVirtualSbrkIndex = this.virtualSbrkIndex;
    const newVirtualSbrkIndex = createMemoryIndex(this.virtualSbrkIndex + length);

    // no alllocation needed
    if (newVirtualSbrkIndex <= currentSbrkIndex) {
      this.virtualSbrkIndex = newVirtualSbrkIndex;
      return currentVirtualSbrkIndex;
    }

    // we have to "close" the last "virtual page"
    const lastWriteableMemoryCell = createMemoryIndex(Math.max(currentSbrkIndex - 1, 0));
    const lastAllocatedPageNumber = getPageNumber(lastWriteableMemoryCell);
    const lastAllocatedPage = this.memory.get(lastAllocatedPageNumber);
    if (lastAllocatedPage instanceof VirtualPage) {
      const allocatedLength = lastAllocatedPage.sbrk(currentSbrkIndex);
      this.sbrkIndex = createMemoryIndex(this.sbrkIndex + allocatedLength);
      this.virtualSbrkIndex = createMemoryIndex(this.virtualSbrkIndex + Math.min(allocatedLength, length));

      if (allocatedLength >= length) {
        return currentSbrkIndex;
      }
    }

    // standard allocation using "Writeable" pages
    const newSbrkIndex = createMemoryIndex(alignToPageSize(this.sbrkIndex + length));
    const pagesToAllocate = (newSbrkIndex - currentSbrkIndex) / PAGE_SIZE;

    for (let i = 0; i < pagesToAllocate; i++) {
      const startMemoryIndex = createMemoryIndex(currentSbrkIndex + i * PAGE_SIZE);
      const pageNumber = getPageNumber(startMemoryIndex);
      const page = new WriteablePage(startMemoryIndex);
      this.memory.set(pageNumber, page);
    }

    this.virtualSbrkIndex = createMemoryIndex(currentSbrkIndex + length);
    this.sbrkIndex = newSbrkIndex;
    return currentSbrkIndex;
  }

  getPageDump(pageNumber: PageNumber) {
    const page = this.memory.get(pageNumber);
    // Would it be better to return null in case of unallocated page?
    return page?.getPageDump() ?? new Uint8Array(PAGE_SIZE);
  }

  getDirtyPages() {
    return this.memory.keys();
  }
}
