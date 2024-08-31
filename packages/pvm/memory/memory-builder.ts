import { check } from "@typeberry/utils";
import { IncorrectSbrkIndex, PageOverride } from "./errors";
import { Memory } from "./memory";
import { PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { getPageNumber, getStartPageIndex } from "./memory-utils";
import type { PageNumber } from "./page-number";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { readable, writeable } from "./pages/virtual-page";

export class MemoryBuilder {
  private initialMemory: Map<PageNumber, MemoryPage> = new Map();

  setWriteable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    check(start < end, "end has to be bigger than start");
    check(!data || data.length < end - start, "the initial data is longer than address range");
    check(!data || data.length < PAGE_SIZE, "chunk cannot be longer than one page");
    check(
      getPageNumber(start) === getPageNumber(createMemoryIndex(end - 1)),
      "start and end have to be on the same page",
    );

    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber) ?? new VirtualPage(getStartPageIndex(start));
    if (!(page instanceof VirtualPage)) {
      throw new PageOverride();
    }
    page.set(start, end, data, writeable);
    this.initialMemory.set(pageNumber, page);
    return this;
  }

  setReadable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    check(start < end, "end has to be bigger than start");
    check(!data || data.length < end - start, "the initial data is longer than address range");
    check(!data || data.length < PAGE_SIZE, "chunk cannot be longer than one page");
    check(
      getPageNumber(start) === getPageNumber(createMemoryIndex(end - 1)),
      "start and end have to be on the same page",
    );

    const pageNumber = getPageNumber(start);
    const page = this.initialMemory.get(pageNumber) ?? new VirtualPage(getStartPageIndex(start));
    if (!(page instanceof VirtualPage)) {
      throw new PageOverride();
    }
    page.set(start, end, data, readable);
    this.initialMemory.set(pageNumber, page);
    return this;
  }

  setReadablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(!data || data.length < end - start, "the initial data is longer than address range");

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = createMemoryIndex(i * PAGE_SIZE + start);
      const pageNumber = getPageNumber(startIndex);
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new ReadablePage(startIndex, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  setWriteablePages(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    check(start < end, "end has to be bigger than start");
    check(start % PAGE_SIZE === 0, `start needs to be a multiple of page size (${PAGE_SIZE})`);
    check(end % PAGE_SIZE === 0, `end needs to be a multiple of page size (${PAGE_SIZE})`);
    check(!data || data.length < end - start, "the initial data is longer than address range");

    const noOfPages = (end - start) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const startIndex = createMemoryIndex(i * PAGE_SIZE + start);
      const pageNumber = getPageNumber(startIndex);
      const dataChunk = data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      const page = new WriteablePage(startIndex, dataChunk);
      this.initialMemory.set(pageNumber, page);
    }

    return this;
  }

  finalize(sbrkIndex: MemoryIndex, endHeap: MemoryIndex): Memory {
    const firstPage = getPageNumber(sbrkIndex);
    const lastPage = getPageNumber(endHeap);
    for (let i = firstPage; i < lastPage; i++) {
      if (this.initialMemory.has(i)) {
        throw new IncorrectSbrkIndex();
      }
    }

    const memory = new Memory(this.initialMemory);
    memory.setSbrkIndex(sbrkIndex, endHeap);
    this.initialMemory = new Map();
    return memory;
  }
}
