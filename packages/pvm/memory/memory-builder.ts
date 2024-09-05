import { check } from "@typeberry/utils";
import { FinalizedBuilderModification, IncorrectSbrkIndex, PageNotExist, PageOverride, WrongPage } from "./errors";
import { Memory } from "./memory";
import { PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { getPageNumber } from "./memory-utils";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { type PageNumber, createPageIndex } from "./pages/page-utils";
import { createEndChunkIndex, readable, writeable } from "./pages/virtual-page";

export class MemoryBuilder {
  private readonly initialMemory: Map<PageNumber, MemoryPage> = new Map();
  private isFinalized = false;

  private ensureNotFinalized() {
    if (this.isFinalized) {
      throw new FinalizedBuilderModification();
    }
  }

  setWriteable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(data.length <= end - start, "the initial data is longer than address range");
    check(data.length < PAGE_SIZE, "chunk cannot be longer than one page");
    check(
      getPageNumber(start) === getPageNumber(createMemoryIndex(end - 1)),
      "start and end have to be on the same page",
    );

    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber) ?? new VirtualPage(pageNumber);
    if (!(page instanceof VirtualPage)) {
      throw new PageOverride();
    }

    const startPageIndex = createPageIndex(start - page.start);
    const endChunkIndex = createEndChunkIndex(end - page.start);
    page.set(startPageIndex, endChunkIndex, data, writeable);
    this.initialMemory.set(pageNumber, page);
    return this;
  }

  setReadable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(data.length <= end - start, "the initial data is longer than address range");
    check(data.length < PAGE_SIZE, "chunk cannot be longer than one page");
    check(
      getPageNumber(start) === getPageNumber(createMemoryIndex(end - 1)),
      "start and end have to be on the same page",
    );

    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber) ?? new VirtualPage(pageNumber);
    if (!(page instanceof VirtualPage)) {
      throw new PageOverride();
    }

    const startPageIndex = createPageIndex(start - page.start);
    const endChunkIndex = createEndChunkIndex(end - page.start);
    page.set(startPageIndex, endChunkIndex, data, readable);
    this.initialMemory.set(pageNumber, page);
    return this;
  }

  setReadablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(data.length < end - start, "the initial data is longer than address range");

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = createMemoryIndex(i * PAGE_SIZE + start);
      const pageNumber = getPageNumber(startIndex);
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new ReadablePage(pageNumber, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  setWriteablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    this.ensureNotFinalized();
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(data.length < end - start, "the initial data is longer than address range");

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = createMemoryIndex(i * PAGE_SIZE + start);
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
    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber);

    if (!page) {
      throw new PageNotExist();
    }

    if (page instanceof VirtualPage) {
      const startPageIndex = createPageIndex(start - page.start);
      page.fill(startPageIndex, data);
    } else {
      throw new WrongPage();
    }

    return this;
  }

  finalize(sbrkIndex: MemoryIndex, endHeapIndex: MemoryIndex): Memory {
    const firstPage = getPageNumber(sbrkIndex);
    const lastPage = getPageNumber(endHeapIndex);

    for (let i = firstPage; i < lastPage; i++) {
      if (this.initialMemory.has(i)) {
        throw new IncorrectSbrkIndex();
      }
    }

    const memory = new Memory({
      memory: this.initialMemory,
      sbrkIndex,
      endHeapIndex,
    });

    this.isFinalized = true;
    return memory;
  }
}
