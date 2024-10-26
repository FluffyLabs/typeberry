import { PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { MemoryPage } from "./memory-page";
import type { PageIndex, PageNumber } from "./page-utils";

export class ReadablePage extends MemoryPage {
  constructor(
    pageNumber: PageNumber,
    private data: Uint8Array,
  ) {
    super(pageNumber);
  }

  loadInto(result: Uint8Array, startIndex: PageIndex, length: number) {
    const endIndex = startIndex + length;
    if (endIndex > PAGE_SIZE) {
      return new PageFault(PAGE_SIZE);
    }

    const bytes = this.data.subarray(startIndex, endIndex);
    // we zero the bytes, since data might not yet be initialized at `endIndex`.
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
