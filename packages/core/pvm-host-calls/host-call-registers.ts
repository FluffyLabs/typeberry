import { tryAsU64, type U64 } from "@typeberry/numbers";
import { REGISTER_BYTE_SIZE } from "@typeberry/pvm-interface";

export class HostCallRegisters {
  private readonly registers: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.registers = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Get U64 register value. */
  get(registerIndex: number): U64 {
    return tryAsU64(this.registers.getBigUint64(registerIndex * REGISTER_BYTE_SIZE, true));
  }

  /** Set U64 register value. */
  set(registerIndex: number, value: U64) {
    this.registers.setBigUint64(registerIndex * REGISTER_BYTE_SIZE, value, true);
  }

  /** Get all registers encoded into little-endian bytes. */
  getEncoded(): Uint8Array {
    return this.bytes;
  }
}
