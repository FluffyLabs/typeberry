import { check } from "@typeberry/utils";

export const MEMORY_SIZE = 0xff_ff_ff_ff;
export const PAGE_SIZE_SHIFT = 14;
// PAGE_SIZE has to be a power of 2
export const PAGE_SIZE = 1 << PAGE_SIZE_SHIFT;
const MIN_ALLOCATION_SHIFT = 7;
check(MIN_ALLOCATION_SHIFT >= 0 && MIN_ALLOCATION_SHIFT < PAGE_SIZE_SHIFT, "incorrect minimal allocation shift");

export const MIN_ALLOCATION_LENGTH = PAGE_SIZE >> MIN_ALLOCATION_SHIFT;
export const LAST_PAGE_START_MEMORY_INDEX = MEMORY_SIZE - PAGE_SIZE + 1;
