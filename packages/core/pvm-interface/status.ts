/**
 * Result codes for the PVM execution.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e43002e4300?v=0.7.2
 */
export enum Status {
  /** Continue */
  OK = 255,
  /** Finished */
  HALT = 0,
  /** Panic */
  PANIC = 1,
  /** Page-fault */
  FAULT = 2,
  /** Host-call */
  HOST = 3,
  /** Out of gas */
  OOG = 4,
}
