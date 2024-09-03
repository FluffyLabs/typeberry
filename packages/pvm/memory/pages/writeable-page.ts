import { MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "../memory-consts";
import type { MemoryIndex } from "../memory-index";
import { alignToMinimalAllocationLength } from "../memory-utils";
import { createPageIndex } from "../page-index";
import { MemoryPage } from "./memory-page";

/**
 * I had to extend ArrayBuffer type to use resizable ArrayBuffer.
 * We will be able to remove it when this is merged: https://github.com/microsoft/TypeScript/pull/58573
 * And then a new version of TypeScript is released.
 */
declare global {
  interface ArrayBufferConstructor {
    new (length: number, options?: { maxByteLength: number }): ArrayBuffer;
  }

  interface ArrayBuffer {
    resize(length: number): void;
  }
}

export class WriteablePage extends MemoryPage {
  private buffer: ArrayBuffer;
  private view: Uint8Array;

  constructor(start: MemoryIndex, initialData?: Uint8Array) {
    super(start);
    const initialPageLength = initialData ? alignToMinimalAllocationLength(initialData?.length) : MIN_ALLOCATION_LENGTH;
    this.buffer = new ArrayBuffer(initialPageLength, { maxByteLength: PAGE_SIZE });
    this.view = new Uint8Array(this.buffer);
    if (initialData) {
      this.view.set(initialData);
    }
  }

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    check(address > this.start && address + length < this.end, "address within page");
    const startIndex = address - this.start;
    const bytes = this.view.subarray(startIndex, startIndex + length);
    result.fill(0, 0, length);
    result.set(bytes);
    return null;
  }

  storeFrom(address: MemoryIndex, bytes: Uint8Array) {
    const pageIndex = createPageIndex(address - this.start);
    if (this.buffer.byteLength < pageIndex + bytes.length && this.buffer.byteLength < PAGE_SIZE) {
      const newLength = alignToMinimalAllocationLength(address + bytes.length);
      this.buffer.resize(newLength);
    }

    this.view.set(bytes, pageIndex);
    return null;
  }

  getPageDump() {
    return new Uint8Array([...this.view, ...new Uint8Array(PAGE_SIZE - this.view.length)]);
  }
}
