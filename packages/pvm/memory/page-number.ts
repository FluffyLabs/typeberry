import { type Opaque, ensure } from "@typeberry/utils";

import { MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";

export type PageNumber = Opaque<number, "memory page number">;

/** Ensure that given `index` represents an index of one of the pages. */
export function createPageNumber(index: number) {
  return ensure<number, PageNumber>(
    index,
    index >= 0 && index * PAGE_SIZE <= MEMORY_SIZE - PAGE_SIZE + 1,
    `Incorrect page number: ${index}!`,
  );
}
