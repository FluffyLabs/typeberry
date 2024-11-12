import { type Opaque, ensure } from "@typeberry/utils";

import { MAX_MEMORY_INDEX } from "./memory-consts";

export type MemoryIndex = Opaque<number, "memory index">;

export const tryAsMemoryIndex = (index: number): MemoryIndex =>
  ensure(index, index >= 0 && index <= MAX_MEMORY_INDEX, `Incorrect memory index: ${index}!`);
