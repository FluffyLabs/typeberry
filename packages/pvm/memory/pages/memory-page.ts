import { type MemoryIndex, createMemoryIndex } from "../memory-address";
import { PAGE_SIZE } from "../memory-consts";

export abstract class MemoryPage {
  public end: MemoryIndex;

  constructor(public start: MemoryIndex) {
    this.end = createMemoryIndex(start + PAGE_SIZE);
  }

  abstract loadInto(res: Uint8Array, address: MemoryIndex, length: number);
  abstract storeFrom(address: MemoryIndex, data: Uint8Array);
}
