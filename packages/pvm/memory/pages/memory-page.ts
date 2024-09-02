import { AddressIsNotBeginningOfPage, type PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { type MemoryIndex, createMemoryIndex } from "../memory-index";

export abstract class MemoryPage {
  public end: MemoryIndex;

  constructor(public start: MemoryIndex) {
    if (start % PAGE_SIZE !== 0) {
      throw new AddressIsNotBeginningOfPage(start);
    }

    this.end = createMemoryIndex(start + PAGE_SIZE);
  }

  abstract loadInto(res: Uint8Array, address: MemoryIndex, length: number): null | PageFault;
  abstract storeFrom(address: MemoryIndex, data: Uint8Array): null | PageFault;
  abstract getPageDump(): Uint8Array;
}
