import { type Opaque, ensure } from "@typeberry/utils";

import { MEMORY_SIZE } from "./memory-consts";

export type MemoryIndex = Opaque<number, "memory index">;

export function createMemoryIndex(index: number) {
  return ensure<number, MemoryIndex>(index, index >= 0 && index <= MEMORY_SIZE, `Incorrect memory index: ${index}!`);
}
