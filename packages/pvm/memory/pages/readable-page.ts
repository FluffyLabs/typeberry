import type { MemoryIndex } from "../memory-address";
import { PageFault } from "../page-fault";
import { MemoryPage } from "./memory-page";

export class ReadablePage extends MemoryPage {
  constructor(
    start: MemoryIndex,
    private data: Uint8Array,
  ) {
    super(start);
  }

  loadInto(result: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    const startIndex = address - this.start;
    const bytes = this.data.subarray(startIndex, startIndex + length);
    result.fill(0, 0, length);
    result.set(bytes);
  }

  storeFrom(address: MemoryIndex, _data: Uint8Array) {
    return new PageFault(address);
  }
}
