import { PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import type { MemoryIndex } from "../memory-index";
import { MemoryPage } from "./memory-page";

export class ReadablePage extends MemoryPage {
  constructor(
    start: MemoryIndex,
    private data: Uint8Array,
  ) {
    super(start);
  }

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    check(address >= this.start, "incorrect page access");
    const startIndex = address - this.start;
    const bytes = this.data.subarray(startIndex, startIndex + length);
    result.fill(0, 0, length);
    result.set(bytes);
    return null;
  }

  storeFrom(address: MemoryIndex, _data: Uint8Array) {
    return new PageFault(address);
  }

  getPageDump() {
    return new Uint8Array([...this.data, ...new Uint8Array(PAGE_SIZE - this.data.length)]);
  }
}
