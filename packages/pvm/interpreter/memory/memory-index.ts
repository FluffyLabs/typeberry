import { type Opaque, ensure } from "@typeberry/utils";

import { MAX_MEMORY_INDEX } from "./memory-consts";

export type MemoryIndex = Opaque<number, "memory index">;

export const tryAsMemoryIndex = (index: number): MemoryIndex =>
  ensure(index, index >= 0 && index <= MAX_MEMORY_INDEX, `Incorrect memory index: ${index}!`);

export type SbrkIndex = Opaque<number, "sbrk index">;

export const tryAsSbrkIndex = (index: number): SbrkIndex =>
  ensure(index, index >= 0 && index <= MAX_MEMORY_INDEX + 1, `Incorrect sbrk index: ${index}!`);
