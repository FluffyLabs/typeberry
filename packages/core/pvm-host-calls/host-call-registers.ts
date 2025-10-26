import { tryAsU32, tryAsU64, type U32, type U64 } from "@typeberry/numbers";

export interface IHostCallRegisters {
  /** Get U64 register value. */
  get(registerIndex: number): U64;
  /**
   * Get lower U32 register value.
   *
   * NOTE: Should be used for retracting memory address.
   *
   * @see Equivalent of `reg` mod `2^32`.
   */
  getLowerU32(registerIndex: number): U32;
  /** Set U64 register value. */
  set(registerIndex: number, value: U64): void;
  /** Get all registers encoded into little-endian bytes. */
  getEncoded(): Uint8Array;
}

export class HostCallRegisters implements IHostCallRegisters {
  private readonly registers: BigUint64Array;
  constructor(private readonly bytes: Uint8Array) {
    this.registers = new BigUint64Array(bytes.buffer, bytes.byteOffset);
  }

  get(registerIndex: number): U64 {
    return tryAsU64(this.registers[registerIndex]);
  }

  getLowerU32(registerIndex: number): U32 {
    return tryAsU32(Number(this.registers[registerIndex] & 0xffff_ffffn));
  }

  set(registerIndex: number, value: U64) {
    this.registers[registerIndex] = value;
  }

  getEncoded(): Uint8Array {
    return this.bytes;
  }
}
