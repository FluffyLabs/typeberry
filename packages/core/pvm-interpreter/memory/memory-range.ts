import type { MemoryIndex } from "./memory-index";
import { getStartPageIndexFromPageNumber } from "./memory-utils";
import type { PageNumber } from "./pages/page-utils";

export class MemoryRange {
  private constructor(
    public readonly start: MemoryIndex,
    public readonly end: MemoryIndex,
  ) {}

  /** Creates a memory range from memory indexes */
  static fromAddresses(start: MemoryIndex, end: MemoryIndex) {
    return new MemoryRange(start, end);
  }

  /** Creates a memory range from memory pages */
  static fromPageNumbers(start: PageNumber, end: PageNumber) {
    const startIndex = getStartPageIndexFromPageNumber(start);
    const endIndex = getStartPageIndexFromPageNumber(end);
    return new MemoryRange(startIndex, endIndex);
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
  isInRange(point: number) {
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
      this.isInRange(other.end - 1) ||
      other.isInRange(this.start) ||
      other.isInRange(this.end - 1)
    );
  }
}
