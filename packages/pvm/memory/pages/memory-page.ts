import type { PageFault } from "../errors";
// import { PAGE_SIZE } from "../memory-consts";
import type { MemoryIndex } from "../memory-index";
import { getStartPageIndexFromPageNumber } from "../memory-utils";
import type { PageIndex, PageNumber } from "./page-utils";

export abstract class MemoryPage {
  public start: MemoryIndex;

  constructor(pageNumber: PageNumber) {
    this.start = getStartPageIndexFromPageNumber(pageNumber);
  }

  abstract loadInto(res: Uint8Array, address: PageIndex, length: number): null | PageFault;
  abstract storeFrom(address: PageIndex, data: Uint8Array): null | PageFault;
  abstract getPageDump(): Uint8Array;
}
