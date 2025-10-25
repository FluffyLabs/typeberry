import { tryAsU32, type U32 } from "@typeberry/numbers";
import type { OK, Result } from "@typeberry/utils";

export const MAX_MEMORY_INDEX = 0xffff_ffff;
export const MEMORY_SIZE = MAX_MEMORY_INDEX + 1;

const PAGE_SIZE_SHIFT = 12;

export type PageFault = {
  address: U32;
};

export function getPageStartAddress(address: U32) {
  return tryAsU32((address >>> PAGE_SIZE_SHIFT) << PAGE_SIZE_SHIFT);
}

/** Allows store and read segments of memory. */
export interface IMemory {
  /** Store bytes into memory at given address. */
  store(address: U32, bytes: Uint8Array): Result<OK, PageFault>;

  /** Load bytes from memory from given address into given buffer. */
  read(address: U32, result: Uint8Array): Result<OK, PageFault>;
}
