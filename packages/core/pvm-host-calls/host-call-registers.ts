import { tryAsU64, type U64 } from "@typeberry/numbers";

export class HostCallRegisters {
  private readonly registers: BigUint64Array;

  constructor(private readonly bytes: Uint8Array) {
    this.registers = new BigUint64Array(bytes.buffer, bytes.byteOffset);
  }

  /** Get U64 register value. */
  get(registerIndex: number): U64 {
    return tryAsU64(this.registers[registerIndex]);
  }

  /** Set U64 register value. */
  set(registerIndex: number, value: U64) {
    this.registers[registerIndex] = value;
  }

  /** Get all registers encoded into little-endian bytes. */
  getEncoded(): Uint8Array {
    return this.bytes;
  }
}
