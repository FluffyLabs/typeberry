import { MAX_MEMORY_INDEX } from "@typeberry/pvm-interface";
import { asOpaqueType, check, type Opaque } from "@typeberry/utils";

export type MemoryIndex = Opaque<number, "memory index">;

export const tryAsMemoryIndex = (index: number): MemoryIndex => {
  check`${index >= 0 && index <= MAX_MEMORY_INDEX} Incorrect memory index: ${index}!`;
  return asOpaqueType(index);
};

export type SbrkIndex = Opaque<number, "sbrk index">;

export const tryAsSbrkIndex = (index: number): SbrkIndex => {
  check`${index >= 0 && index <= MAX_MEMORY_INDEX + 1} Incorrect sbrk index: ${index}!`;
  return asOpaqueType(index);
};
