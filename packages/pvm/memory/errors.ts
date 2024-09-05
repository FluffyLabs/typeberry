export class PageFault {
  constructor(public address: number) {}
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

export class PageOverride extends Error {
  constructor() {
    super("You try to override existing memory page!");
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
