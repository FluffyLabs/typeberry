import { check } from "@typeberry/utils";
import { FinalizedBuilderModification, IncorrectSbrkIndex, PageNotExist, ReservedMemoryFault } from "./errors.js";
import { Memory } from "./memory.js";
import { PAGE_SIZE } from "./memory-consts.js";
import { type MemoryIndex, type SbrkIndex, tryAsSbrkIndex } from "./memory-index.js";
import { MemoryRange, RESERVED_MEMORY_RANGE } from "./memory-range.js";
import { getPageNumber } from "./memory-utils.js";
import { PageRange } from "./page-range.js";
import { ReadablePage, WriteablePage } from "./pages/index.js";
import type { MemoryPage } from "./pages/memory-page.js";
import { type PageNumber, tryAsPageIndex } from "./pages/page-utils.js";

export class MemoryBuilder {
  private readonly initialMemory: Map<PageNumber, MemoryPage> = new Map();
  private isFinalized = false;

  private ensureNotFinalized() {
    if (this.isFinalized) {
      throw new FinalizedBuilderModification();
    }
  }

  private ensureNoReservedMemoryUsage(range: MemoryRange) {
    if (range.overlapsWith(RESERVED_MEMORY_RANGE)) {
      throw new ReservedMemoryFault();
    }
  }

  /**
   * Create entire readable pages to handle the `[start, end)` range.
   *
   * Note that both `start` and `end` must be multiple of the `PAGE_SIZE`, i.e.
   * they need to be the start indices of the pages.
   *
   * The data passed will be placed at `start`, but might be shorter than the requested range,
   * prepend it with zeros if you don't wish to have it at the beginning of the page.
   */
  setReadablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(data.length <= end - start, "the initial data is longer than address range");

    const length = end - start;
    const range = MemoryRange.fromStartAndLength(start, length);

    this.ensureNoReservedMemoryUsage(range);

    const pages = Array.from(PageRange.fromMemoryRange(range));
    const noOfPages = pages.length;

    for (let i = 0; i < noOfPages; i++) {
      const pageNumber = pages[i];
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new ReadablePage(pageNumber, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  /**
   * Create entire writeable pages to handle the `[start, end)` range.
   *
   * Note that both `start` and `end` must be multiple of the `PAGE_SIZE`, i.e.
   * they need to be the start indices of the pages.
   *
   * The data passed will be placed at `start`, but might be shorter than the requested range,
   * prepend it with zeros if you don't wish to have it at the beginning of the page.
   */
  setWriteablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(data.length <= end - start, "the initial data is longer than address range");

    const length = end - start;
    const range = MemoryRange.fromStartAndLength(start, length);

    this.ensureNoReservedMemoryUsage(range);

    const pages = Array.from(PageRange.fromMemoryRange(range));
    const noOfPages = pages.length;

    for (let i = 0; i < noOfPages; i++) {
      const pageNumber = pages[i];
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new WriteablePage(pageNumber, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  /**
   * This function can be useful when page map and initial memory data are provided separatelly.
   * You can use setWriteablePages/setReadablePages to create empty pages and then setData to fill them
   */
  setData(start: MemoryIndex, data: Uint8Array) {
    this.ensureNotFinalized();
    const pageOffset = start % PAGE_SIZE;
    const remainingSpaceOnPage = PAGE_SIZE - pageOffset;
    check(data.length <= remainingSpaceOnPage, "The data has to fit into a single page.");

    const length = data.length;
    const range = MemoryRange.fromStartAndLength(start, length);

    this.ensureNoReservedMemoryUsage(range);

    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber);

    if (page === undefined) {
      throw new PageNotExist();
    }

    const startPageIndex = tryAsPageIndex(start - page.start);
    page.setData(startPageIndex, data);

    return this;
  }

  finalize(startHeapIndex: MemoryIndex, endHeapIndex: SbrkIndex): Memory {
    check(
      startHeapIndex <= endHeapIndex,
      `startHeapIndex (${startHeapIndex}) has to be less than or equal to endHeapIndex (${endHeapIndex})`,
    );
    this.ensureNotFinalized();

    const range = MemoryRange.fromStartAndLength(startHeapIndex, endHeapIndex - startHeapIndex);
    const pages = PageRange.fromMemoryRange(range);

    for (const pageNumber of pages) {
      if (this.initialMemory.has(pageNumber)) {
        throw new IncorrectSbrkIndex();
      }
    }

    const memory = Memory.fromInitialMemory({
      memory: this.initialMemory,
      sbrkIndex: tryAsSbrkIndex(startHeapIndex),
      endHeapIndex,
    });

    this.isFinalized = true;
    return memory;
  }
}
