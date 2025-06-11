import { OK, Result } from "@typeberry/utils";
import { OutOfMemory, PageFault } from "./errors.js";
import { MAX_MEMORY_INDEX, PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "./memory-consts.js";
import { type MemoryIndex, type SbrkIndex, tryAsSbrkIndex } from "./memory-index.js";
import { MemoryRange, RESERVED_MEMORY_RANGE } from "./memory-range.js";
import { alignToPageSize, getPageNumber } from "./memory-utils.js";
import { PageRange } from "./page-range.js";
import { WriteablePage } from "./pages/index.js";
import type { MemoryPage } from "./pages/memory-page.js";
import { type PageNumber, tryAsPageIndex } from "./pages/page-utils.js";

type InitialMemoryState = {
  memory: Map<PageNumber, MemoryPage>;
  sbrkIndex: SbrkIndex;
  endHeapIndex: SbrkIndex;
};

enum AccessType {
  READ = 0,
  WRITE = 1,
}
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
    private sbrkIndex = tryAsSbrkIndex(RESERVED_MEMORY_RANGE.end),
    private virtualSbrkIndex = tryAsSbrkIndex(RESERVED_MEMORY_RANGE.end),
    private endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX),
    private memory = new Map<PageNumber, MemoryPage>(),
  ) {}

  reset() {
    this.sbrkIndex = tryAsSbrkIndex(RESERVED_MEMORY_RANGE.end);
    this.virtualSbrkIndex = tryAsSbrkIndex(RESERVED_MEMORY_RANGE.end);
    this.endHeapIndex = tryAsSbrkIndex(MAX_MEMORY_INDEX);
    this.memory = new Map<PageNumber, MemoryPage>(); // TODO [MaSi]: We should keep allocated pages somewhere and reuse it when it is possible
  }

  copyFrom(memory: Memory) {
    this.sbrkIndex = memory.sbrkIndex;
    this.virtualSbrkIndex = memory.virtualSbrkIndex;
    this.endHeapIndex = memory.endHeapIndex;
    this.memory = memory.memory;
  }

  storeFrom(address: MemoryIndex, bytes: Uint8Array): Result<OK, PageFault> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    const pagesResult = this.getPages(address, bytes.length, AccessType.WRITE);

    if (pagesResult.isError) {
      return Result.error(pagesResult.error);
    }

    const pages = pagesResult.ok;
    let currentPosition: number = address;
    let bytesLeft = bytes.length;

    for (const page of pages) {
      const pageStartIndex = tryAsPageIndex(currentPosition % PAGE_SIZE);
      const bytesToWrite = Math.min(PAGE_SIZE - pageStartIndex, bytesLeft);
      const sourceStartIndex = currentPosition - address;
      const source = bytes.subarray(sourceStartIndex, sourceStartIndex + bytesToWrite);

      page.storeFrom(pageStartIndex, source);

      currentPosition += bytesToWrite;
      bytesLeft -= bytesToWrite;
    }
    return Result.ok(OK);
  }

  private getPages(startAddress: MemoryIndex, length: number, accessType: AccessType): Result<MemoryPage[], PageFault> {
    if (length === 0) {
      return Result.ok([]);
    }

    const memoryRange = MemoryRange.fromStartAndLength(startAddress, length);
    const pageRange = PageRange.fromMemoryRange(memoryRange);

    const pages: MemoryPage[] = [];

    for (const pageNumber of pageRange) {
      if (pageNumber < RESERVED_NUMBER_OF_PAGES) {
        return Result.error(PageFault.fromPageNumber(pageNumber, true));
      }

      const page = this.memory.get(pageNumber);

      if (page === undefined) {
        return Result.error(PageFault.fromPageNumber(pageNumber));
      }

      if (accessType === AccessType.WRITE && !page.isWriteable()) {
        return Result.error(PageFault.fromPageNumber(pageNumber, true));
      }

      pages.push(page);
    }

    return Result.ok(pages);
  }
  /**
   * Read content of the memory at `[address, address + result.length)` and
   * write the result into the `result` buffer.
   *
   * Returns `null` if the data was read successfully or `PageFault` otherwise.
   */
  loadInto(result: Uint8Array, startAddress: MemoryIndex): Result<OK, PageFault> {
    if (result.length === 0) {
      return Result.ok(OK);
    }

    const pagesResult = this.getPages(startAddress, result.length, AccessType.READ);

    if (pagesResult.isError) {
      return Result.error(pagesResult.error);
    }

    const pages = pagesResult.ok;

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

    return Result.ok(OK);
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
    // TODO [MaSi]: `getPageNumber` works incorrectly for SbrkIndex. Sbrk index should be changed to MemoryIndex
    const firstPageNumber = getPageNumber(currentSbrkIndex);
    const pagesToAllocate = (newSbrkIndex - currentSbrkIndex) / PAGE_SIZE;
    const rangeToAllocate = PageRange.fromStartAndLength(firstPageNumber, pagesToAllocate);

    for (const pageNumber of rangeToAllocate) {
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
