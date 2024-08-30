import { type Opaque, ensure } from "@typeberry/utils";

import { PAGE_SIZE } from "./memory-consts";

export type PageIndex = Opaque<number, "memory page index">;

export function createPageIndex(index: number) {
  return ensure<number, PageIndex>(index, index >= 0 && index < PAGE_SIZE, `Incorect page index: ${index}!`);
}
