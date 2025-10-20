import type { U32 } from "@typeberry/numbers";
import type { OK, Result } from "@typeberry/utils";

export const MAX_MEMORY_INDEX = 0xffff_ffff;
export const MEMORY_SIZE = MAX_MEMORY_INDEX + 1;

export type PageFault = {
  address: U32;
};

export interface IMemory {
  /** Store bytes into memory at given address. */
  storeFrom(address: U32, bytes: Uint8Array): Result<OK, PageFault>;

  /** Load bytes from memory from given address into given buffer. */
  loadInto(address: U32, result: Uint8Array): Result<OK, PageFault>;
}
