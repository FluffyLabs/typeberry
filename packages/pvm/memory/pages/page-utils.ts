import { type Opaque, ensure } from "@typeberry/utils";

import { LAST_PAGE_NUMBER, PAGE_SIZE } from "../memory-consts";

export type PageIndex = Opaque<number, "memory page index">;
export type PageNumber = Opaque<number, "memory page number">;

/** Ensure that given memory `index` is within `0...PAGE_SIZE` and can be used to index a page */
export function createPageIndex(index: number) {
  return ensure<number, PageIndex>(index, index >= 0 && index < PAGE_SIZE, `Incorect page index: ${index}!`);
}

/** Ensure that given `index` represents an index of one of the pages. */
export function createPageNumber(index: number) {
  return ensure<number, PageNumber>(
    index,
    index >= 0 && index * PAGE_SIZE <= LAST_PAGE_NUMBER,
    `Incorrect page number: ${index}!`,
  );
}

/** Get the next page number and wrap the result if it is bigger than LAST_PAGE_NUMBER */
export function getNextPageNumber(pageNumber: PageNumber): PageNumber {
  const newPageNumber = pageNumber === LAST_PAGE_NUMBER ? 0 : pageNumber + 1;
  return createPageNumber(newPageNumber);
}
