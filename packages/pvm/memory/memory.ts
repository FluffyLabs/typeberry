import { PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { alignToPageSize } from "./memory-utils";
import { PageFault } from "./errors";
import { type PageNumber, createPageNumber } from "./page-number";
import { WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";

export class Memory {
  sbrkIndex: MemoryIndex = createMemoryIndex(0);
  virtualSbrkIndex: MemoryIndex = createMemoryIndex(0);

  constructor(private memory: Map<PageNumber, MemoryPage> = new Map()) {}

  private getPageNumberFor(address: number): PageNumber {
    return createPageNumber(address >>> 4);
  }

  setSbrkIndex(index: MemoryIndex) {
    this.sbrkIndex = index;
    this.virtualSbrkIndex = index;
  }

  storeFrom(address: MemoryIndex, bytes: Uint8Array) {
    const pageNumber = this.getPageNumberFor(address);
    const page = this.memory.get(pageNumber);
    if (!page) {
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
      page.storeFrom(address, bytes.subarray(0, toStoreOnFirstPage));
      secondPage.storeFrom(address, bytes.subarray(toStoreOnFirstPage, toStoreOnFirstPage + toStoreOnSecondPage));
    } else {
      page.storeFrom(address, bytes);
    }
  }

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 4) {
    const pageNumber = this.getPageNumberFor(address);
    const page = this.memory.get(pageNumber);
    if (!page) {
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
      page.loadInto(result, address, toReadFromFirstPage); // subarray
      secondPage.loadInto(result, secondPage.start, toReadFromSecondPage); // subarray
    } else {
      page.loadInto(result, address, length);
    }
  }

  sbrk(length: number): MemoryIndex {
    // check if length + sbrkInddex < initialSbrkIndex + maxHeap
    const currentSbrkIndex = this.sbrkIndex;
    const currentVirtualSbrkIndex = this.virtualSbrkIndex;
    const newVirtualSbrkIndex = createMemoryIndex(this.virtualSbrkIndex + length);

    // no alllocation needed
    if (newVirtualSbrkIndex <= currentSbrkIndex) {
      this.virtualSbrkIndex = newVirtualSbrkIndex;
      return currentVirtualSbrkIndex;
    }

    const newSbrkIndex = createMemoryIndex(alignToPageSize(this.sbrkIndex + length));
    const pagesToAllocate = newSbrkIndex / PAGE_SIZE;

    for (let i = 0; i < pagesToAllocate; i++) {
      const startMemoryIndex = createMemoryIndex(currentSbrkIndex + i * PAGE_SIZE);
      const pageNumber = createPageNumber(startMemoryIndex >>> 4);
      const page = new WriteablePage(startMemoryIndex); // initial page length do zmiany np 4kB (25% page size)
      this.memory.set(pageNumber, page);
    }

    this.virtualSbrkIndex = createMemoryIndex(currentSbrkIndex + length);
    this.sbrkIndex = newSbrkIndex;
    return currentSbrkIndex;
  }
}
