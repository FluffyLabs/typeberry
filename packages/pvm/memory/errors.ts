import type { MemoryIndex } from "./memory-index";

export class PageFault {
  constructor(public address: number) {}
}

export class AddressIsNotBeginningOfPage extends Error {
  constructor(address: MemoryIndex) {
    super(`address ${address} is not the beginning of a page`);
  }
}

export class ChunkOverlap extends Error {
  constructor() {
    super("Memory chunks cannot overlap each other!");
  }
}

export class ChunkTooLong extends Error {
  constructor() {
    super("Memory chunk is longer than the address range!");
  }
}
