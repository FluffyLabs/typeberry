import { check } from "@typeberry/utils";
import { MAX_NUMBER_OF_PAGES, PAGE_SIZE } from "./memory-consts";
import type { MemoryRange } from "./memory-range";
import { getPageNumber } from "./memory-utils";
import { type PageNumber, getNextPageNumber, tryAsPageNumber } from "./pages/page-utils";

export class PageRange {
  public readonly end: PageNumber;

  private constructor(
    public readonly start: PageNumber,
    public readonly length: number,
  ) {
    this.end = tryAsPageNumber((this.start + this.length) % MAX_NUMBER_OF_PAGES);
  }

  static fromMemoryRange(range: MemoryRange) {
    const startPage = getPageNumber(range.start);

    if (range.isEmpty()) {
      return new PageRange(startPage, 0);
    }

    const pageWithLastIndex = getPageNumber(range.end);
    const endPage = range.end % PAGE_SIZE !== 0 ? getNextPageNumber(pageWithLastIndex) : pageWithLastIndex;

    if ((startPage === endPage || startPage === pageWithLastIndex) && range.length > PAGE_SIZE) {
      // full range
      return new PageRange(startPage, MAX_NUMBER_OF_PAGES);
    }

    const length = startPage < endPage ? endPage - startPage : MAX_NUMBER_OF_PAGES - startPage + endPage;
    return PageRange.fromStartAndLength(startPage, length);
  }

  static fromStartAndLength(start: PageNumber, length: number) {
    check(length >= 0, "length must be non-negative");
    check(length < MAX_NUMBER_OF_PAGES, `length cannot be bigger than ${MAX_NUMBER_OF_PAGES}`);
    return new PageRange(start, length);
  }

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
      // console.log(i, end)
      yield i;
      i = getNextPageNumber(i);
    } while (i !== end);
  }
}
