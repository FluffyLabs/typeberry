import { check } from "@typeberry/utils";
import { Memory } from "./memory";
import { type MemoryIndex, createMemoryIndex } from "./memory-address";
import { PAGE_SIZE } from "./memory-consts";
import { type PageNumber, createPageNumber } from "./page-number";
import { ReadablePage, VirtualPage, WriteablePage } from "./pages";
import type { MemoryPage } from "./pages/memory-page";
import { readable, writeable } from "./pages/virtual-page";

export class MemoryBuilder {
  private initialMemory: Map<PageNumber, MemoryPage> = new Map();

  setWriteable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    check(!data || data.length < end - start + 1, "the initial data is longer than address range");
    const noOfPages = (end - start + 1) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const pageNumber = createPageNumber(start + i * PAGE_SIZE);
      const startPageAddress = createMemoryIndex(pageNumber << 4);
      const isFullPage = end >= startPageAddress + PAGE_SIZE;
      if (isFullPage) {
        const page = new WriteablePage(startPageAddress, PAGE_SIZE, data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
        this.initialMemory.set(pageNumber, page);
      } else {
        const page = new VirtualPage(startPageAddress);
        page.set(start, end, data, writeable);
        this.initialMemory.set(pageNumber, page);
      }
    }
    return this;
  }

  setReadable(start: MemoryIndex, end: MemoryIndex, data: Uint8Array = new Uint8Array()) {
    const segmentLength = end - start + 1;
    check(!data || data.length < segmentLength, "the initial data is longer than address range");
    const noOfPages = (end - start + 1) / PAGE_SIZE;

    for (let i = 0; i < noOfPages; i++) {
      const pageNumber = createPageNumber(start + i * PAGE_SIZE);
      const startPageAddress = createMemoryIndex(pageNumber << 4);
      const isFullPage = end >= startPageAddress + PAGE_SIZE;
      if (isFullPage) {
        const page = new ReadablePage(startPageAddress, data.subarray(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
        this.initialMemory.set(pageNumber, page);
      } else {
        // 
        const page = new VirtualPage(startPageAddress);
        page.set(start, end, data, readable);
        this.initialMemory.set(pageNumber, page);
      }
    }

    return this;
  }

  finalize(sbrkIndex: MemoryIndex, maxHeap: number): Memory {

    // if (sbrkIndex + maxHeap < 2 ** 32 -1) {

    // } // alokacja tylko na pustym kawałku
    const memory = new Memory(this.initialMemory);
    memory.setSbrkIndex(sbrkIndex);
    this.initialMemory = new Map();
    return memory;
  }
}
