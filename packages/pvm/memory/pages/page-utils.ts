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
  return ensure<number, PageNumber>(index, index >= 0 && index <= LAST_PAGE_NUMBER, `Incorrect page number: ${index}!`);
}

/**
 * Get the next page number and wrap the result if it is bigger than LAST_PAGE_NUMBER
 *
 * GP references:
 * 1. The modulo subscription operator is used in all load/store instructions, for example:
 * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMjMiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDllIGg2IHk3NjcgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4OWUgaDYgeTc2NyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
 *
 * 2. Here is the definition of the modulo subscription operator:
 * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiNyIsIk5vdGF0aW9uYWwgQ29udmVudGlvbnMiLCJDcnlwdG9ncmFwaHkiLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEyIGhiIHk0YyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgzOCBoYiB5NGMgZmYxMyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
 */
export function getNextPageNumber(pageNumber: PageNumber): PageNumber {
  const newPageNumber = pageNumber === LAST_PAGE_NUMBER ? 0 : pageNumber + 1;
  return createPageNumber(newPageNumber);
}
