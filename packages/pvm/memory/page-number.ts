import { type Opaque, ensure } from "@typeberry/utils";

import { MEMORY_SIZE, PAGE_SIZE } from "./memory-consts";

export type PageNumber = Opaque<number, "memory page number">;

export function createPageNumber(index: number) {
  return ensure<number, PageNumber>(index, index >= 0 && index * PAGE_SIZE < MEMORY_SIZE - PAGE_SIZE);
}
