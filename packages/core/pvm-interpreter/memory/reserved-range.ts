import { PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "./memory-consts";
import { tryAsMemoryIndex } from "./memory-index";
import { MemoryRange } from "./memory-range";

/**
 *
 *
 * it should be in memory-consts but it cannot be there becasue of circular dependency
 */
export const RESERVED_MEMORY_RANGE = MemoryRange.fromStartAndLength(
  tryAsMemoryIndex(0),
  RESERVED_NUMBER_OF_PAGES * PAGE_SIZE,
);
