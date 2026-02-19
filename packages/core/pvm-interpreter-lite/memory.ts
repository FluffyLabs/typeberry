import { tryAsU32, type U32 } from "@typeberry/numbers";
import { type IMemory, MAX_MEMORY_INDEX, type PageFault } from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";
import { BufferPool } from "./buffer-pool.js";
import { Page, PageAccess } from "./page.js";

const PAGE_SIZE = 4096;
const PAGE_SIZE_SHIFT = 12;
const RESERVED_NUMBER_OF_PAGES = 16;

/**
 * High-performance page-based memory.
 *
 * Optimizations:
 * - Single Page class (monomorphic V8 hidden class)
 * - Page cache for last-accessed page (eliminates Map.get for repeated access)
 * - BufferPool for writeable page buffer recycling
 * - Numeric return codes instead of Result<OK, PageFault> on hot path
 * - Bitwise page number / offset computation
 */
export class Memory implements IMemory {
  private pages = new Map<number, Page>();
  readonly bufferPool = new BufferPool();

  // ---- sbrk state ----
  private sbrkIndex = RESERVED_NUMBER_OF_PAGES * PAGE_SIZE;
  private virtualSbrkIndex = RESERVED_NUMBER_OF_PAGES * PAGE_SIZE;
  private endHeapIndex = MAX_MEMORY_INDEX;

  // ---- page cache ----
  private cachedPageNum = -1;
  private cachedPage: Page | null = null;

  // ---- IMemory interface (used by host calls) ----

  store(address: U32, bytes: Uint8Array): Result<OK, PageFault> {
    const result = this.fastStore(address as number, bytes);
    if (result === 0) {
      return Result.ok(OK);
    }
    const addr = tryAsU32((address as number) >>> 0);
    return Result.error({ address: addr }, () => `Page fault at address ${addr}`);
  }

  read(address: U32, output: Uint8Array): Result<OK, PageFault> {
    const result = this.fastLoad(output, address as number);
    if (result === 0) {
      return Result.ok(OK);
    }
    const addr = tryAsU32((address as number) >>> 0);
    return Result.error({ address: addr }, () => `Page fault at address ${addr}`);
  }

  // ---- fast path for interpreter handlers: returns 0=ok, 1=fault, 2=access_fault ----

  /**
   * Load bytes from memory into result buffer.
   * Returns: 0 = success, 1 = page fault (unmapped), 2 = access fault (shouldn't happen for read)
   */
  fastLoad(result: Uint8Array, address: number): number {
    const len = result.length;
    if (len === 0) {
      return 0;
    }

    const pageNum = address >>> PAGE_SIZE_SHIFT;
    const offset = address & 0xfff;

    // Fast path: single page (most common: 1-8 byte loads within one page)
    if (offset + len <= PAGE_SIZE) {
      let page: Page | null = null;
      if (pageNum === this.cachedPageNum && this.cachedPage !== null) {
        page = this.cachedPage;
      } else {
        page = this.lookupAndCache(pageNum);
      }
      if (page === null) {
        return pageNum < RESERVED_NUMBER_OF_PAGES ? 2 : 1;
      }
      const data = page.data;
      for (let i = 0; i < len; i++) {
        result[i] = data[offset + i] ?? 0;
      }
      return 0;
    }

    return this.loadSlow(result, address);
  }

  /**
   * Store bytes from source buffer into memory.
   * Returns: 0 = success, 1 = page fault, 2 = access fault (write to read-only)
   */
  fastStore(address: number, bytes: Uint8Array): number {
    const len = bytes.length;
    if (len === 0) {
      return 0;
    }

    const pageNum = address >>> PAGE_SIZE_SHIFT;
    const offset = address & 0xfff;

    // Fast path: single page
    if (offset + len <= PAGE_SIZE) {
      let page: Page | null = null;
      if (pageNum === this.cachedPageNum && this.cachedPage !== null) {
        page = this.cachedPage;
      } else {
        page = this.lookupAndCache(pageNum);
      }
      if (page === null) {
        return pageNum < RESERVED_NUMBER_OF_PAGES ? 2 : 1;
      }
      if (!(page.access & 2)) {
        return 2; // not writable
      }
      const data = page.data;
      for (let i = 0; i < len; i++) {
        data[offset + i] = bytes[i];
      }
      return 0;
    }

    return this.storeSlow(address, bytes);
  }

  // ---- slow paths (cross-page) ----

  private loadSlow(result: Uint8Array, startAddress: number): number {
    let pos = startAddress;
    let bytesLeft = result.length;
    let destIdx = 0;

    while (bytesLeft > 0) {
      const pageNum = pos >>> PAGE_SIZE_SHIFT;
      const offset = pos & 0xfff;
      const page = this.lookupAndCache(pageNum);
      if (page === null) {
        return pageNum < RESERVED_NUMBER_OF_PAGES ? 2 : 1;
      }
      const toRead = Math.min(PAGE_SIZE - offset, bytesLeft);
      const data = page.data;
      for (let i = 0; i < toRead; i++) {
        result[destIdx + i] = data[offset + i] ?? 0;
      }
      pos = (pos + toRead) >>> 0;
      bytesLeft -= toRead;
      destIdx += toRead;
    }
    return 0;
  }

  private storeSlow(startAddress: number, bytes: Uint8Array): number {
    let pos = startAddress;
    let bytesLeft = bytes.length;
    let srcIdx = 0;

    while (bytesLeft > 0) {
      const pageNum = pos >>> PAGE_SIZE_SHIFT;
      const offset = pos & 0xfff;
      const page = this.lookupAndCache(pageNum);
      if (page === null) {
        return pageNum < RESERVED_NUMBER_OF_PAGES ? 2 : 1;
      }
      if (!(page.access & 2)) {
        return 2;
      }
      const toWrite = Math.min(PAGE_SIZE - offset, bytesLeft);
      const data = page.data;
      for (let i = 0; i < toWrite; i++) {
        data[offset + i] = bytes[srcIdx + i];
      }
      pos = (pos + toWrite) >>> 0;
      bytesLeft -= toWrite;
      srcIdx += toWrite;
    }
    return 0;
  }

  private lookupAndCache(pageNum: number): Page | null {
    const page = this.pages.get(pageNum) ?? null;
    if (page !== null) {
      this.cachedPageNum = pageNum;
      this.cachedPage = page;
    }
    return page;
  }

  // ---- page management ----

  setPage(pageNum: number, page: Page): void {
    this.pages.set(pageNum, page);
  }

  getPage(pageNum: number): Page | undefined {
    return this.pages.get(pageNum);
  }

  getPageDump(pageNumber: number): Uint8Array | null {
    const page = this.pages.get(pageNumber);
    if (page === undefined) {
      return null;
    }
    return page.data;
  }

  getDirtyPages() {
    return this.pages.keys();
  }

  /**
   * sbrk - grow heap. Returns the OLD virtual sbrk index (before growth).
   * Returns -1 on out-of-memory.
   */
  sbrk(length: number): number {
    const currentVirtualSbrk = this.virtualSbrkIndex;

    if (MAX_MEMORY_INDEX < currentVirtualSbrk + length || currentVirtualSbrk + length > this.endHeapIndex) {
      return -1; // out of memory
    }

    const newVirtualSbrk = currentVirtualSbrk + length;

    if (newVirtualSbrk <= this.sbrkIndex) {
      this.virtualSbrkIndex = newVirtualSbrk;
      return currentVirtualSbrk;
    }

    // Align to page boundary
    const newSbrk = Math.ceil(newVirtualSbrk / PAGE_SIZE) * PAGE_SIZE;
    const firstPageNum = this.sbrkIndex >>> PAGE_SIZE_SHIFT;
    const pagesToAllocate = (newSbrk - this.sbrkIndex) / PAGE_SIZE;

    for (let i = 0; i < pagesToAllocate; i++) {
      const pageNum = firstPageNum + i;
      const buf = this.bufferPool.acquire();
      this.pages.set(pageNum, new Page(buf, PageAccess.READ_WRITE));
    }

    this.virtualSbrkIndex = newVirtualSbrk;
    this.sbrkIndex = newSbrk;
    return currentVirtualSbrk;
  }

  // ---- initialization ----

  setSbrkState(sbrkIndex: number, endHeapIndex: number): void {
    this.sbrkIndex = sbrkIndex;
    this.virtualSbrkIndex = sbrkIndex;
    this.endHeapIndex = endHeapIndex;
  }

  reset(): void {
    // Return writeable page buffers to pool
    for (const page of this.pages.values()) {
      if (page.access === PageAccess.READ_WRITE) {
        this.bufferPool.release(page.data);
      }
    }
    this.pages.clear();
    this.cachedPageNum = -1;
    this.cachedPage = null;
    this.sbrkIndex = RESERVED_NUMBER_OF_PAGES * PAGE_SIZE;
    this.virtualSbrkIndex = RESERVED_NUMBER_OF_PAGES * PAGE_SIZE;
    this.endHeapIndex = MAX_MEMORY_INDEX;
  }

  copyFrom(other: Memory): void {
    this.reset();
    for (const [pageNum, page] of other.pages) {
      if (page.access === PageAccess.READ_WRITE) {
        const buf = this.bufferPool.acquire();
        buf.set(page.data);
        this.pages.set(pageNum, new Page(buf, PageAccess.READ_WRITE));
      } else {
        // Read-only pages share the same data reference
        this.pages.set(pageNum, page);
      }
    }
    this.sbrkIndex = other.sbrkIndex;
    this.virtualSbrkIndex = other.virtualSbrkIndex;
    this.endHeapIndex = other.endHeapIndex;
  }
}
