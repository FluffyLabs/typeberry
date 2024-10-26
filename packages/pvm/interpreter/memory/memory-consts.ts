import { check } from "@typeberry/utils";

export const MAX_MEMORY_INDEX = 0xff_ff_ff_ff;
export const MEMORY_SIZE = MAX_MEMORY_INDEX + 1;
export const PAGE_SIZE_SHIFT = 14;
// PAGE_SIZE has to be a power of 2
export const PAGE_SIZE = 1 << PAGE_SIZE_SHIFT;
const MIN_ALLOCATION_SHIFT = (() => {
  const MIN_ALLOCATION_SHIFT = 7;
  check(MIN_ALLOCATION_SHIFT >= 0 && MIN_ALLOCATION_SHIFT < PAGE_SIZE_SHIFT, "incorrect minimal allocation shift");
  return MIN_ALLOCATION_SHIFT;
})();

export const MIN_ALLOCATION_LENGTH = PAGE_SIZE >> MIN_ALLOCATION_SHIFT;
export const LAST_PAGE_NUMBER = (MEMORY_SIZE - PAGE_SIZE) / PAGE_SIZE;
