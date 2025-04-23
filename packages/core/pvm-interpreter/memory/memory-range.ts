import { MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";
import { getPageNumber } from "./memory-utils";
import { getNextPageNumber } from "./pages/page-utils";

export class MemoryRange {
  private constructor(
    public readonly start: MemoryIndex,
    public readonly end: MemoryIndex,
  ) {}

  /** Creates a memory range from memory indexes */
  static fromAddresses(start: MemoryIndex, end: MemoryIndex) {
    return new MemoryRange(start, end);
  }

  /** Creates a memory range from given starting point and length */
  static fromStartAndLength(start: MemoryIndex, length: number) {
    const end = tryAsMemoryIndex((start + length) % MEMORY_SIZE);
    return new MemoryRange(start, end);
  }

  /** Checks if a range is empty (`start` === `end`) */
  isEmpty() {
    return this.start === this.end;
  }

  /** Returns true if the range is wrapped (`start` > `end`) */
  isWrapped() {
    return this.start > this.end;
  }

  /** Checks if the given point is within the range */
  isInRange(point: MemoryIndex) {
    if (this.isWrapped()) {
      return point >= this.start || point < this.end;
    }

    return point >= this.start && point < this.end;
  }

  /** Checks if this range overlaps with another range */
  overlapsWith(other: MemoryRange) {
    if (this.isEmpty() || other.isEmpty()) {
      return false;
    }

    return (
      this.isInRange(other.start) ||
      this.isInRange(tryAsMemoryIndex(other.end - 1)) ||
      other.isInRange(this.start) ||
      other.isInRange(tryAsMemoryIndex(this.end - 1))
    );
  }

  *getPageNumbers() {
    if (this.isEmpty()) {
      return;
    }

    let currentPageNumber = getPageNumber(this.start);
    const endPageNumber =
      this.end % PAGE_SIZE === 0 ? getPageNumber(this.end) : getNextPageNumber(getPageNumber(this.end));

    while (currentPageNumber !== endPageNumber) {
      yield currentPageNumber;
      currentPageNumber = getNextPageNumber(currentPageNumber);
    }
  }
}
