import { PageFault } from "../errors";
import { MemoryPage } from "./memory-page";
import type { PageIndex, PageNumber } from "./page-utils";

export class ReadablePage extends MemoryPage {
  constructor(
    pageNumber: PageNumber,
    private data: Uint8Array,
  ) {
    super(pageNumber);
  }

  loadInto(result: Uint8Array, startIndex: PageIndex, length: 1 | 2 | 3 | 4) {
    const bytes = this.data.subarray(startIndex, startIndex + length);
    result.fill(0, 0, length);
    result.set(bytes);
    return null;
  }

  storeFrom(address: PageIndex, _data: Uint8Array) {
    return new PageFault(address);
  }

  getPageDump() {
    return this.data;
  }
}
