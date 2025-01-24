import { MEMORY_SIZE } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";

export class PageFault {
  public address: MemoryIndex;
  constructor(address: number) {
    this.address = tryAsMemoryIndex(address % MEMORY_SIZE);
  }
}

export class StoreOnReadablePage {}

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

export class IncorrectSbrkIndex extends Error {
  constructor() {
    super("Space between sbrk index and max heap index should be empty!");
  }
}

export class FinalizedBuilderModification extends Error {
  constructor() {
    super("MemoryBuilder was finalized and cannot be changed!");
  }
}

export class PageNotExist extends Error {
  constructor() {
    super("You try to fill data on memory page that does not exist!");
  }
}

export class ChunkNotFound extends Error {
  constructor() {
    super("Chunk does not exist or is too short");
  }
}
export class OutOfMemory extends Error {
  constructor() {
    super("Out of memory");
  }
}
