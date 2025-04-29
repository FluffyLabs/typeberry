import { MEMORY_SIZE, PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";

export class MemoryRange {
  public readonly end: MemoryIndex;
  public readonly lastIndex: MemoryIndex | null = null;

  private constructor(
    public readonly start: MemoryIndex,
    public readonly length: number,
  ) {
    this.end = tryAsMemoryIndex((this.start + this.length) % MEMORY_SIZE);

    if (length > 0) {
      this.lastIndex = tryAsMemoryIndex((this.end - 1 + MEMORY_SIZE) % MEMORY_SIZE);
    }
  }

  /** Creates a memory range from given starting point and length */
  static fromStartAndLength(start: MemoryIndex, length: number) {
    if (!Number.isInteger(length) || length < 0 || length > MEMORY_SIZE) {
      throw new TypeError(`length must be a non-negative integer and less than ${MEMORY_SIZE}, got ${length}`);
    }

    return new MemoryRange(start, length);
  }

  /** Checks if a range is empty (`length === 0`) */
  isEmpty() {
    return this.length === 0;
  }

  /** Returns true if the range is wrapped (`start` >= `end`) and is not empty */
  isWrapped() {
    return this.start >= this.end && !this.isEmpty();
  }

  /** Checks if given memory address is within the range */
  isInRange(address: MemoryIndex) {
    if (this.isWrapped()) {
      return address >= this.start || address < this.end;
    }

    return address >= this.start && address < this.end;
  }

  /** Checks if this range overlaps with another range */
  overlapsWith(other: MemoryRange) {
    if (this.isEmpty() || other.isEmpty()) {
      return false;
    }

    return (
      this.isInRange(other.start) ||
      this.isInRange(tryAsMemoryIndex((other.end - 1 + MEMORY_SIZE) % MEMORY_SIZE)) ||
      other.isInRange(this.start) ||
      other.isInRange(tryAsMemoryIndex((this.end - 1 + MEMORY_SIZE) % MEMORY_SIZE))
    );
  }
}

/**
 * The first 16 pages of memory are reserved.
 *
 * https://graypaper.fluffylabs.dev/#/cc517d7/24d00024d000?v=0.6.5
 *
 * it should be in memory-consts but it cannot be there becasue of circular dependency
 */
export const RESERVED_MEMORY_RANGE = MemoryRange.fromStartAndLength(
  tryAsMemoryIndex(0),
  RESERVED_NUMBER_OF_PAGES * PAGE_SIZE,
);
