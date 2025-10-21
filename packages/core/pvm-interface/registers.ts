import type { U64 } from "@typeberry/numbers";

export interface IRegisters {
  /** Get single register value. */
  get(registerIndex: number): U64;
  /** Set single register value. */
  set(registerIndex: number, value: U64): void;
  /** Get all registers encoded into little-endian bytes. */
  getAllEncoded(): Uint8Array;
  /** Set all registers from little-endian encoded bytes. */
  setAllFromBytes(bytes: Uint8Array): void;
}
