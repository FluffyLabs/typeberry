import { check } from "@typeberry/utils";

export const MAX_MEMORY_INDEX = 0xffff_ffff;
export const MEMORY_SIZE = MAX_MEMORY_INDEX + 1;
export const PAGE_SIZE_SHIFT = 12;
// PAGE_SIZE has to be a power of 2
export const PAGE_SIZE = 1 << PAGE_SIZE_SHIFT;
const MIN_ALLOCATION_SHIFT = (() => {
  const MIN_ALLOCATION_SHIFT = 7;
  check(MIN_ALLOCATION_SHIFT >= 0 && MIN_ALLOCATION_SHIFT < PAGE_SIZE_SHIFT, "incorrect minimal allocation shift");
  return MIN_ALLOCATION_SHIFT;
})();

export const MIN_ALLOCATION_LENGTH = PAGE_SIZE >> MIN_ALLOCATION_SHIFT;
export const LAST_PAGE_NUMBER = (MEMORY_SIZE - PAGE_SIZE) / PAGE_SIZE;

/** https://graypaper.fluffylabs.dev/#/68eaa1f/35a60235a602?v=0.6.4 */
export const RESERVED_NUMBER_OF_PAGES = 16;
/** https://graypaper.fluffylabs.dev/#/68eaa1f/35a60235a602?v=0.6.4 */
export const MAX_NUMBER_OF_PAGES = MEMORY_SIZE / PAGE_SIZE;
