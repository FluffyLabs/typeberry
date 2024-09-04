import { type Opaque, ensure } from "@typeberry/utils";

import { MEMORY_SIZE, PAGE_SIZE } from "../memory-consts";

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
    index >= 0 && index * PAGE_SIZE <= MEMORY_SIZE - PAGE_SIZE + 1,
    `Incorrect page number: ${index}!`,
  );
}
