import { MEMORY_SIZE, PageFault as InterpreterPageFault } from "@typeberry/pvm-interface";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index.js";
import { getStartPageIndex, getStartPageIndexFromPageNumber } from "./memory-utils.js";
import { tryAsPageNumber } from "./pages/page-utils.js";
import { tryAsU32, U32 } from "@typeberry/numbers";

export class PageFault implements InterpreterPageFault {
  private constructor(
    public address: U32,
    public isAccessFault = true,
  ) {}

  static fromPageNumber(maybePageNumber: number, isAccessFault = false) {
    const pageNumber = tryAsPageNumber(maybePageNumber);
    const startPageIndex = getStartPageIndexFromPageNumber(pageNumber);
    return new PageFault(tryAsU32(startPageIndex), isAccessFault);
  }

  static fromMemoryIndex(maybeMemoryIndex: number, isAccessFault = false) {
    const memoryIndex = tryAsMemoryIndex(maybeMemoryIndex % MEMORY_SIZE);
    const startPageIndex = getStartPageIndex(memoryIndex);
    return new PageFault(tryAsU32(startPageIndex), isAccessFault);
  }
}

export class OutOfBounds extends Error {
  constructor() {
    super("Out of bounds");
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
