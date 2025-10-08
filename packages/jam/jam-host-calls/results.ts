import { tryAsU64 } from "@typeberry/numbers";

/**
 * Host call result constants.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/2c7c022c7c02?v=0.6.3
 */
export const HostCallResult = {
  /** The return value indicating an item does not exist. */
  NONE: tryAsU64(0xffff_ffff_ffff_ffffn), // 2**64 - 1
  /** Name unknown. */
  WHAT: tryAsU64(0xffff_ffff_ffff_fffen), // 2**64 - 2
  /** The inner PVM memory index provided for reading/writing is not accessible. */
  OOB: tryAsU64(0xffff_ffff_ffff_fffdn), // 2**64 - 3
  /** Index unknown. */
  WHO: tryAsU64(0xffff_ffff_ffff_fffcn), // 2**64 - 4
  /** Storage full or resource already allocated. */
  FULL: tryAsU64(0xffff_ffff_ffff_fffbn), // 2**64 - 5
  /** Core index unknown. */
  CORE: tryAsU64(0xffff_ffff_ffff_fffan), // 2**64 - 6
  /** Insufficient funds. */
  CASH: tryAsU64(0xffff_ffff_ffff_fff9n), // 2**64 - 7
  /** Gas limit too low. */
  LOW: tryAsU64(0xffff_ffff_ffff_fff8n), // 2**64 - 8
  /** The item is already solicited, cannot be forgotten or the operation is invalid due to privilege level. */
  HUH: tryAsU64(0xffff_ffff_ffff_fff7n), // 2**64 - 9
  /** The return value indicating general success. */
  OK: tryAsU64(0n),
} as const;
