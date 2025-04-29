import { MAX_NUMBER_OF_PAGES, PAGE_SIZE } from "./memory-consts";
import type { MemoryRange } from "./memory-range";
import { getPageNumber } from "./memory-utils";
import { type PageNumber, getNextPageNumber, tryAsPageNumber } from "./pages/page-utils";

/**
 * A half-open range of memory pages. Similarly to [`MemoryRange`], can be empty
 * or wrapped around the memory.
 */
export class PageRange {
  /**
   * Exclusive end of the page range.
   *
   * NOTE: it may be smaller than `start` in case the range is wrapped.
   */
  public readonly end: PageNumber;

  private constructor(
    public readonly start: PageNumber,
    public readonly length: number,
  ) {
    this.end = tryAsPageNumber((this.start + this.length) % MAX_NUMBER_OF_PAGES);
  }

  /**
   * Creates range of pages that includes all indices in a given memory range.
   *
   * Example: For memory range `[PAGE_SIZE, MEMORY_SIZE - PAGE_SIZE)`
   *                  we will get `[1, MAX_NUMBER_OF_PAGES - 1)` page range.
   */
  static fromMemoryRange(range: MemoryRange) {
    const startPage = getPageNumber(range.start);

    if (range.isEmpty()) {
      return new PageRange(startPage, 0);
    }

    // lastIndex is not null because we just ensured that the range is not empty
    const pageWithLastIndex = getPageNumber(range.lastIndex ?? range.end);
    const endPage = getNextPageNumber(pageWithLastIndex);

    if ((startPage === endPage || startPage === pageWithLastIndex) && range.length > PAGE_SIZE) {
      // full range
      return new PageRange(startPage, MAX_NUMBER_OF_PAGES);
    }

    const length = startPage < endPage ? endPage - startPage : MAX_NUMBER_OF_PAGES - startPage + endPage;
    return PageRange.fromStartAndLength(startPage, length);
  }

  /** Creates a page range from given starting point and length */
  static fromStartAndLength(start: PageNumber, length: number) {
    if (!Number.isInteger(length) || length < 0 || length > MAX_NUMBER_OF_PAGES) {
      throw new TypeError(`length must be a non-negative integer and less than ${MAX_NUMBER_OF_PAGES}, got ${length}`);
    }
    return new PageRange(start, length);
  }

  /** Checks if a range is empty (`length === 0`) */
  isEmpty() {
    return this.length === 0;
  }

  *[Symbol.iterator]() {
    if (this.isEmpty()) {
      return;
    }

    const end = this.end;
    let i = this.start;

    do {
      yield i;
      i = getNextPageNumber(i);
    } while (i !== end);
  }
}
