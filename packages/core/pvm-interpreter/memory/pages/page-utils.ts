import { asOpaqueType, check, type Opaque } from "@typeberry/utils";

import { LAST_PAGE_NUMBER, PAGE_SIZE } from "../memory-consts.js";

export type PageIndex = Opaque<number, "memory page index">;
export type PageNumber = Opaque<number, "memory page number">;

/** Ensure that given memory `index` is within `[0...PAGE_SIZE)` and can be used to index a page */
export const tryAsPageIndex = (index: number): PageIndex => {
  check`${index >= 0 && index < PAGE_SIZE}, Incorect page index: ${index}!`;
  return asOpaqueType(index);
};

/** Ensure that given `index` represents an index of one of the pages. */
export const tryAsPageNumber = (index: number): PageNumber => {
  check`${index >= 0 && index <= LAST_PAGE_NUMBER}, Incorect page number: ${index}!`;
  return asOpaqueType(index);
};

/**
 * Get the next page number and wrap the result if it is bigger than LAST_PAGE_NUMBER
 *
 * GP references:
 * 1. The modulo subscription operator is used in all load/store instructions, for example:
 * https://graypaper.fluffylabs.dev/#/579bd12/25af0125af01
 *
 * 2. Here is the definition of the modulo subscription operator:
 * https://graypaper.fluffylabs.dev/#/579bd12/073a00073a00
 */
export function getNextPageNumber(pageNumber: PageNumber): PageNumber {
  const newPageNumber = pageNumber === LAST_PAGE_NUMBER ? 0 : pageNumber + 1;
  return tryAsPageNumber(newPageNumber);
}
