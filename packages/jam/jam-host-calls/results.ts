import { tryAsU64 } from "@typeberry/numbers";

/**
 * Host call result constants.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/2c77022c7702
 */
export enum LegacyHostCallResult {
  /** The return value indicating an item does not exist. */
  NONE = 0xffffffff, // 2**32 - 1 = 4294967295
  /** Name unknown. */
  WHAT = 0xfffffffe, // 2**32 - 2 = 4294967294
  /** The return value for when a memory index is provided for reading/writing which is not accessible. */
  OOB = 0xfffffffd, // 2**32 - 3 = 4294967293
  /** Index unknown. */
  WHO = 0xfffffffc, // 2**32 - 4 = 4294967292
  /** Storage full. */
  FULL = 0xfffffffb, // 2**32 - 5 = 4294967291
  /** Core index unknown. */
  CORE = 0xfffffffa, // 2**32 - 6 = 4294967290
  /** Insufficient funds. */
  CASH = 0xfffffff9, // 2**32 - 7 = 4294967289
  /** Gas limit too low. */
  LOW = 0xfffffff8, // 2**32 - 8 = 4294967288
  /** Gas limit too high. */
  HIGH = 0xfffffff7, // 2**32 - 9 = 4294967287
  /** The item is already solicited or cannot be forgotten. */
  HUH = 0xfffffff6, // 2**32 - 10 = 4294967286
  /** The return value indicating general success. */
  OK = 0,
}

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
  /** Storage full. */
  FULL: tryAsU64(0xffff_ffff_ffff_fffbn), // 2**64 - 5
  /** Core index unknown. */
  CORE: tryAsU64(0xffff_ffff_ffff_fffan), // 2**64 - 6
  /** Insufficient funds. */
  CASH: tryAsU64(0xffff_ffff_ffff_fff9n), // 2**64 - 7
  /** Gas limit too low. */
  LOW: tryAsU64(0xffff_ffff_ffff_fffd8n), // 2**64 - 8
  /** The item is already solicited or cannot be forgotten. */
  HUH: tryAsU64(0xffff_ffff_ffff_fff7n), // 2**64 - 9
  /** The return value indicating general success. */
  OK: tryAsU64(0n),
} as const;
