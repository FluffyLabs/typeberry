import type { U64 } from "@typeberry/numbers";

export interface IRegisters {
  /** Get single register value. */
  get(registerIndex: number): U64;
  /** Set single register value. */
  set(registerIndex: number, value: U64): void;
  /** Get all registers encoded into bytes. */
  getEncoded(): Uint8Array;
}
