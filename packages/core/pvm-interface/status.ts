/**
 * Result codes for the PVM execution.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e43002e4300?v=0.7.2
 */
export enum Status {
  OK = 255,
  HALT = 0,
  PANIC = 1,
  FAULT = 2,
  HOST = 3,
  OOG = 4,
}
