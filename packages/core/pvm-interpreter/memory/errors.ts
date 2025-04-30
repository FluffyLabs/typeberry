import { MEMORY_SIZE } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";
import { getStartPageIndex, getStartPageIndexFromPageNumber } from "./memory-utils";
import { tryAsPageNumber } from "./pages/page-utils";

export class PageFault {
  private constructor(
    public address: MemoryIndex,
    public isAccessFault = true,
  ) {}

  static fromPageNumber(maybePageNumber: number, isAccessFault = false) {
    const pageNumber = tryAsPageNumber(maybePageNumber);
    const startPageIndex = getStartPageIndexFromPageNumber(pageNumber);
    return new PageFault(startPageIndex, isAccessFault);
  }

  static fromMemoryIndex(maybeMemoryIndex: number, isAccessFault = false) {
    const memoryIndex = tryAsMemoryIndex(maybeMemoryIndex % MEMORY_SIZE);
    const startPageIndex = getStartPageIndex(memoryIndex);
    return new PageFault(startPageIndex, isAccessFault);
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

export class ReservedMemoryFault extends Error {
  constructor() {
    super("You are trying to access reserved memory!");
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
