import { check } from "@typeberry/utils";
import type { MemoryIndex } from "../memory-address";
import { PAGE_SIZE } from "../memory-consts";
import { createPageIndex } from "../page-index";
import { MemoryPage } from "./memory-page";

export class WriteablePage extends MemoryPage {
  private buffer: ArrayBuffer;
  private view: Uint8Array;

  constructor(start: MemoryIndex, initialPageLength: number, initialData = new Uint8Array()) {
    super(start);
    check(initialPageLength > 0 && initialPageLength <= PAGE_SIZE, "incorrect page length");
    this.buffer = new ArrayBuffer(initialPageLength, { maxByteLength: PAGE_SIZE });
    this.view = new Uint8Array(this.buffer);
    this.view.set(initialData);
  }

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    const startIndex = address - this.start;
    const bytes = this.view.subarray(startIndex, startIndex + length);
    result.fill(0, 0, length);
    result.set(bytes);
  }

  storeFrom(address: MemoryIndex, bytes: Uint8Array) {
    if (this.buffer.byteLength < address + bytes.length) {
      this.buffer.resize(address + bytes.length);
    }
    const pageIndex = createPageIndex(address - this.start);
    this.view.set(bytes, pageIndex);
  }
}
