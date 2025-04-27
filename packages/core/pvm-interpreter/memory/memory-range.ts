import { check } from "@typeberry/utils";
import { MEMORY_SIZE } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";

export class MemoryRange {
  private constructor(
    public readonly start: MemoryIndex,
    public readonly length: number,
  ) {}

  get end() {
    return tryAsMemoryIndex((this.start + this.length) % MEMORY_SIZE);
  }

  /** Creates a memory range from given starting point and length */
  static fromStartAndLength(start: MemoryIndex, length: number) {
    check(length >= 0, "length must be non-negative");
    check(length <= MEMORY_SIZE, "length cannot be bigger than 2 ** 32");

    return new MemoryRange(start, length);
  }

  /** Checks if a range is empty (`start` === `end`) */
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
