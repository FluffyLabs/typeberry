import { Result } from "@typeberry/utils";
import { OutOfMemory, PageFault } from "./errors";
import { MAX_MEMORY_INDEX, MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, type SbrkIndex, tryAsMemoryIndex, tryAsSbrkIndex } from "./memory-index";
import { alignToPageSize, getPageNumber, getStartPageIndex, getStartPageIndexFromPageNumber } from "./memory-utils";
import { WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, getNextPageNumber, tryAsPageIndex } from "./pages/page-utils";

type InitialMemoryState = {
  memory: Map<PageNumber, MemoryPage>;
  sbrkIndex: SbrkIndex;
  endHeapIndex: SbrkIndex;
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
    private sbrkIndex = tryAsSbrkIndex(0),
    private virtualSbrkIndex = tryAsSbrkIndex(0),
    private endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX),
    private memory = new Map<PageNumber, MemoryPage>(),
  ) {}

  reset() {
    this.sbrkIndex = tryAsSbrkIndex(0);
    this.virtualSbrkIndex = tryAsSbrkIndex(0);
    this.endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
    this.memory = new Map<PageNumber, MemoryPage>(); // TODO [MaSi]: We should keep allocated pages somewhere and reuse it when it is possible
  }

  copyFrom(memory: Memory) {
    this.sbrkIndex = memory.sbrkIndex;
    this.virtualSbrkIndex = memory.virtualSbrkIndex;
    this.endHeapIndex = memory.endHeapIndex;
    this.memory = memory.memory;
  }

  // TODO [ToDr] This should support writing to more than two pages.
  storeFrom(address: MemoryIndex, bytes: Uint8Array): null | PageFault {
    if (bytes.length === 0) {
      return null;
    }

    const verificationResult = this.verifyReservedPages(address, bytes.length);

    if (verificationResult !== null) {
      return verificationResult;
    }

    const pageNumber = getPageNumber(address);
    const page = this.memory.get(pageNumber);
    if (page === undefined) {
      const faultAddress = getStartPageIndexFromPageNumber(pageNumber);
      return new PageFault(faultAddress);
    }

    const firstPageIndex = tryAsPageIndex(address - page.start);
    const pageEnd = page.start + PAGE_SIZE;

    if (address + bytes.length <= pageEnd) {
      return page.storeFrom(firstPageIndex, bytes);
    }

    // bytes span two pages, so we need to split it and store separately.
    const toStoreOnSecondPage = address + bytes.length - pageEnd;
    const toStoreOnFirstPage = bytes.length - toStoreOnSecondPage;

    // secondPageNumber will be 0 if pageNumber is the last page
    const secondPageNumber = getNextPageNumber(pageNumber);
    const secondPage = this.memory.get(secondPageNumber);

    if (secondPage === undefined) {
      const faultAddress = getStartPageIndexFromPageNumber(secondPageNumber);
      return new PageFault(faultAddress);
    }

    const firstPageStoreResult = page.storeFrom(firstPageIndex, bytes.subarray(0, toStoreOnFirstPage));

    if (firstPageStoreResult !== null) {
      return firstPageStoreResult;
    }
    return secondPage.storeFrom(
      tryAsPageIndex(0),
      bytes.subarray(toStoreOnFirstPage, toStoreOnFirstPage + toStoreOnSecondPage),
    );
  }

  /**
   * Check if given memory slice `[destinationStart, destinationEnd)` is valid
   * and writeable.
   *
   * Returns false otherwise.
   */
  isWriteable(destinationStart: MemoryIndex, length: number): boolean {
    if (length === 0) {
      return true;
    }

    if (destinationStart + length > MEMORY_SIZE) {
      return false;
    }

    const destinationEnd = tryAsMemoryIndex(destinationStart + length - 1);
    const pageOffsetZero = tryAsPageIndex(0);

    const startPage = getPageNumber(destinationStart);
    const lastPage = getPageNumber(destinationEnd);
    let pageOffset = tryAsPageIndex(destinationStart - getStartPageIndexFromPageNumber(startPage));
    for (let i = startPage; i <= lastPage; i++) {
      const page = this.memory.get(i);
      if (page === undefined) {
        return false;
      }

      const pageOffsetEnd =
        i === lastPage ? tryAsPageIndex(1 + destinationEnd - getStartPageIndexFromPageNumber(lastPage)) : PAGE_SIZE;
      const len = pageOffsetEnd - pageOffset;
      if (!page.isWriteable(pageOffset, len)) {
        return false;
      }
      // reset page offset.
      pageOffset = pageOffsetZero;
    }

    return true;
  }

  private getPages(startAddress: MemoryIndex, length: number): Result<MemoryPage[], PageFault> {
    if (length === 0) {
      return Result.ok([]);
    }

    const firstPageNumber = getPageNumber(startAddress);
    const wrappedEndAddress = (startAddress + length) % MEMORY_SIZE;
    const lastPageNumber = getPageNumber(
      tryAsMemoryIndex((wrappedEndAddress === 0 ? MEMORY_SIZE : wrappedEndAddress) - 1),
    ); // - 1 here is okay as length > 0
    const pageAfterLast = getNextPageNumber(lastPageNumber);
    const pages: MemoryPage[] = [];

    let currentPageNumber = firstPageNumber;

    while (currentPageNumber !== pageAfterLast) {
      const page = this.memory.get(currentPageNumber);

      if (page === undefined) {
        const faultAddress = getStartPageIndexFromPageNumber(currentPageNumber);
        const fault = new PageFault(faultAddress);
        return Result.error(fault);
      }

      pages.push(page);

      currentPageNumber = getNextPageNumber(currentPageNumber);
    }

    return Result.ok(pages);
  }
  /**
   * Read content of the memory at `[address, address + result.length)` and
   * write the result into the `result` buffer.
   *
   * Returns `null` if the data was read successfully or `PageFault` otherwise.
   */
  loadInto(result: Uint8Array, startAddress: MemoryIndex): null | PageFault {
    if (result.length === 0) {
      return null;
    }

    const verificationResult = this.verifyReservedPages(startAddress, result.length);

    if (verificationResult !== null) {
      return verificationResult;
    }

    const pagesResult = this.getPages(startAddress, result.length);

    if (pagesResult.isError) {
      return pagesResult.error;
    }

    const pages = pagesResult.ok;
    const noOfPages = pages.length;

    if (noOfPages === 0) {
      return null;
    }

    let currentPosition: number = startAddress;
    let bytesLeft = result.length;

    for (const page of pages) {
      const pageStartIndex = tryAsPageIndex(currentPosition % PAGE_SIZE);
      const bytesToRead = Math.min(PAGE_SIZE - pageStartIndex, bytesLeft);
      const destinationStartIndex = currentPosition - startAddress;
      const destination = result.subarray(destinationStartIndex);

      page.loadInto(destination, pageStartIndex, bytesToRead);

      currentPosition += bytesToRead;
      bytesLeft -= bytesToRead;
    }
    return null;
  }

  /**
   * Verify if we try to touch reserved memory pages [0; 16)
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/247300247600?v=0.6.4
   */
  verifyReservedPages(startAddress: MemoryIndex, length: number): null | PageFault {
    const startPageNumber = getPageNumber(startAddress);
    const endAddress = tryAsMemoryIndex((startAddress + length - 1) % MEMORY_SIZE);
    const endPageNumber = getPageNumber(endAddress);

    const START_RESERVED_PAGE = 0;
    const END_RESERVED_PAGE = 16;

    /**
     * There are 4 posibilities:
     * [ 0 ... start ... 16 ... end ... ]
     * [ 0 ... start ... end ... 16 ... ]
     * [ 0 ... end ... 16 ... start ... ]
     * [ 0 ... 16 ... end ... start ... ]
     */

    if (startPageNumber >= START_RESERVED_PAGE && startPageNumber < END_RESERVED_PAGE) {
      const pageStartIndex = getStartPageIndex(startAddress);
      return new PageFault(pageStartIndex, false);
    }

    if (endPageNumber >= START_RESERVED_PAGE && endPageNumber < END_RESERVED_PAGE) {
      return new PageFault(0, false);
    }

    if (startPageNumber > endPageNumber) {
      return new PageFault(0, false);
    }

    return null;
  }

  sbrk(length: number): SbrkIndex {
    const currentSbrkIndex = this.sbrkIndex;
    const currentVirtualSbrkIndex = this.virtualSbrkIndex;

    // new sbrk index is bigger than 2 ** 32 or endHeapIndex
    if (MAX_MEMORY_INDEX < currentVirtualSbrkIndex + length || currentVirtualSbrkIndex + length > this.endHeapIndex) {
      throw new OutOfMemory();
    }

    const newVirtualSbrkIndex = tryAsSbrkIndex(this.virtualSbrkIndex + length);

    // no alllocation needed
    if (newVirtualSbrkIndex <= currentSbrkIndex) {
      this.virtualSbrkIndex = newVirtualSbrkIndex;
      return currentVirtualSbrkIndex;
    }

    // standard allocation using "Writeable" pages
    const newSbrkIndex = tryAsSbrkIndex(alignToPageSize(newVirtualSbrkIndex));
    const pagesToAllocate = (newSbrkIndex - currentSbrkIndex) / PAGE_SIZE;

    for (let i = 0; i < pagesToAllocate; i++) {
      const startMemoryIndex = tryAsMemoryIndex(currentSbrkIndex + i * PAGE_SIZE);
      const pageNumber = getPageNumber(startMemoryIndex);
      const page = new WriteablePage(pageNumber);
      this.memory.set(pageNumber, page);
    }

    this.virtualSbrkIndex = newVirtualSbrkIndex;
    this.sbrkIndex = newSbrkIndex;
    return currentVirtualSbrkIndex;
  }

  getPageDump(pageNumber: PageNumber) {
    const page = this.memory.get(pageNumber);
    return page?.getPageDump() ?? null;
  }

  getDirtyPages() {
    return this.memory.keys();
  }
}
