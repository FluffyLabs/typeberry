import { PageFault } from "../errors";
import { MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "../memory-consts";
import { MemoryPage } from "./memory-page";
import type { PageIndex, PageNumber } from "./page-utils";

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

  constructor(pageNumber: PageNumber, initialData?: Uint8Array) {
    super(pageNumber);
    const dataLength = initialData?.length ?? 0;
    const initialPageLength = Math.min(PAGE_SIZE, Math.max(dataLength, MIN_ALLOCATION_LENGTH));
    this.buffer = new ArrayBuffer(initialPageLength, { maxByteLength: PAGE_SIZE });
    this.view = new Uint8Array(this.buffer);
    if (initialData) {
      this.view.set(initialData);
    }
  }

  loadInto(result: Uint8Array, startIndex: PageIndex, length: number) {
    const endIndex = startIndex + length;
    if (endIndex > PAGE_SIZE) {
      return new PageFault(PAGE_SIZE);
    }

    const bytes = this.view.subarray(startIndex, endIndex);
    // we zero the bytes, since the view might not yet be initialized at `endIndex`.
    result.fill(0, bytes.length, length);
    result.set(bytes);
    return null;
  }

  storeFrom(startIndex: PageIndex, bytes: Uint8Array) {
    if (this.buffer.byteLength < startIndex + bytes.length && this.buffer.byteLength < PAGE_SIZE) {
      const newLength = Math.min(PAGE_SIZE, Math.max(MIN_ALLOCATION_LENGTH, startIndex + bytes.length));
      this.buffer.resize(newLength);
    }

    this.view.set(bytes, startIndex);
    return null;
  }

  setData(pageIndex: PageIndex, data: Uint8Array) {
    if (this.buffer.byteLength < pageIndex + data.length && this.buffer.byteLength < PAGE_SIZE) {
      const newLength = Math.min(PAGE_SIZE, Math.max(MIN_ALLOCATION_LENGTH, pageIndex + data.length));
      this.buffer.resize(newLength);
    }
    this.view.set(data, pageIndex);
  }

  isWriteable() {
    return true;
  }

  getPageDump() {
    return this.view;
  }
}
