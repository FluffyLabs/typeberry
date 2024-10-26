/**
 * Host call result constants.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/298002298002
 */
export enum HostCallResult {
  /** The return value indicating an item does not exist. */
  NONE = 0xffffffff, // 2**32 - 1
  /** Name unknown. */
  WHAT = 0xfffffffe, // 2**32 - 2
  /** The return value for when a memory index is provided for reading/writing which is not accessible. */
  OOB = 0xfffffffd, // 2**32 - 3
  /** Index unknown. */
  WHO = 0xfffffffc, // 2**32 - 4
  /** Storage full. */
  FULL = 0xfffffffb, // 2**32 - 5
  /** Core index unknown. */
  CORE = 0xfffffffa, // 2**32 - 6
  /** Insufficient funds. */
  CASH = 0xfffffff9, // 2**32 - 7
  /** Gas limit too low. */
  LOW = 0xfffffff8, // 2**32 - 8
  /** Gas limit too high. */
  HIGH = 0xfffffff7, // 2**32 - 9
  /** The item is already solicited or cannot be forgotten. */
  HUH = 0xfffffff6, // 2**32 - 10
  /** The return value indicating general success. */
  OK = 0,
}
