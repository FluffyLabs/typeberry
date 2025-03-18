/**
 * Inner status codes for the PVM
 *
 * https://graypaper.fluffylabs.dev/#/85129da/2cae022cae02?v=0.6.3
 */
export enum Status {
  OK = 255,
  HALT = 0,
  PANIC = 1,
  FAULT = 2,
  HOST = 3,
  OOG = 4,
}
