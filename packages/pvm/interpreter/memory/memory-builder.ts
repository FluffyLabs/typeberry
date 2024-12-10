import { check } from "@typeberry/utils";
import { FinalizedBuilderModification, IncorrectSbrkIndex, PageNotExist } from "./errors";
import { Memory } from "./memory";
import { PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";
import { getPageNumber } from "./memory-utils";
import { ReadablePage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, tryAsPageIndex } from "./pages/page-utils";

export class MemoryBuilder {
  private readonly initialMemory: Map<PageNumber, MemoryPage> = new Map();
  private isFinalized = false;

  private ensureNotFinalized() {
    if (this.isFinalized) {
      throw new FinalizedBuilderModification();
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

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = tryAsMemoryIndex(i * PAGE_SIZE + start);
      const pageNumber = getPageNumber(startIndex);
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

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = tryAsMemoryIndex(i * PAGE_SIZE + start);
      const pageNumber = getPageNumber(startIndex);
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new WriteablePage(pageNumber, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  /**
   * This function can be useful when page map and initial memory data are provided separatelly.
   * You can use setWriteable/setReadable to create empty pages and then setData to fill them
   */
  setData(start: MemoryIndex, data: Uint8Array) {
    this.ensureNotFinalized();
    const end = tryAsMemoryIndex(start + data.length);
    check(getPageNumber(start) === getPageNumber(end), "The data has to fit into a single page.");
    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber);

    if (!page) {
      throw new PageNotExist();
    }

    const startPageIndex = tryAsPageIndex(start - page.start);
    page.storeFrom(startPageIndex, data);

    return this;
  }

  finalize(sbrkIndex: MemoryIndex, endHeapIndex: MemoryIndex): Memory {
    this.ensureNotFinalized();
    const firstPage = getPageNumber(sbrkIndex);
    const lastPage = getPageNumber(endHeapIndex);

    for (let i = firstPage; i < lastPage; i++) {
      if (this.initialMemory.has(i)) {
        throw new IncorrectSbrkIndex();
      }
    }

    const memory = Memory.fromInitialMemory({
      memory: this.initialMemory,
      sbrkIndex,
      endHeapIndex,
    });

    this.isFinalized = true;
    return memory;
  }
}
