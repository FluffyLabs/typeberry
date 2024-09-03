import { type Opaque, ensure } from "@typeberry/utils";

import { PAGE_SIZE } from "./memory-consts";

export type PageIndex = Opaque<number, "memory page index">;

/** Ensure that given memory `index` is within `0...PAGE_SIZE` and can be used to index a page */
export function createPageIndex(index: number) {
  return ensure<number, PageIndex>(index, index >= 0 && index < PAGE_SIZE, `Incorect page index: ${index}!`);
}
