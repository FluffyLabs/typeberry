export enum Result {
  HALT = 0,
  PANIC = 2 ** 32 - 12,
  FAULT = 2 ** 32 - 13,
  HOST = 2 ** 32 - 14,
}
