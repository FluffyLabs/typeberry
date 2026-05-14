import { tryAsU64, type U64 } from "@typeberry/numbers";
import { NO_OF_REGISTERS, REGISTER_BYTE_SIZE } from "@typeberry/pvm-interface";
import { check } from "@typeberry/utils";
import type { IoTracker } from "./ecalli-io-tracker.js";

export class HostCallRegisters {
  private readonly raw: Uint8Array;
  private readonly registers: DataView;
  // Track register modifications.
  public ioTracker: IoTracker | null = null;

  /** Creates empty registers object. */
  static empty(noOfRegisters = NO_OF_REGISTERS) {
    return HostCallRegisters.fromRaw(new Uint8Array(noOfRegisters * REGISTER_BYTE_SIZE));
  }

  /** Creates new `HostCallRegisters` by wrapping an already allocated byte array. */
  static fromRaw(bytes: Uint8Array) {
    check`${bytes.length % REGISTER_BYTE_SIZE === 0} registers array must be a multiply of ${REGISTER_BYTE_SIZE},
    got: ${bytes.length}`;
    return new HostCallRegisters(bytes);
  }

  private constructor(private readonly bytes: Uint8Array) {
    this.raw = bytes;
    this.registers = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Get U64 register value. */
  get(registerIndex: number): U64 {
    return tryAsU64(this.registers.getBigUint64(registerIndex * REGISTER_BYTE_SIZE, true));
  }

  /** Set U64 register value. */
  set(registerIndex: number, value: U64) {
    this.registers.setBigUint64(registerIndex * REGISTER_BYTE_SIZE, value, true);
    if (this.ioTracker !== null) {
      this.ioTracker.setReg(registerIndex, value);
    }
  }

  /** Get all registers encoded into little-endian bytes. */
  getEncoded(): Uint8Array {
    return this.bytes;
  }

  /** Ovewrite all encoded registers. */
  setEncoded(bytes: Uint8Array) {
    check`${bytes.length === this.raw.length} Invalid registers array: ${bytes.length} vs ${this.raw.length}`;
    this.raw.set(bytes, 0);
  }

  toString() {
    const elementCount = this.raw.byteLength / REGISTER_BYTE_SIZE;
    const values = new BigUint64Array(this.raw.buffer, this.raw.byteOffset, elementCount);
    const entries: string[] = [];
    for (const [idx, value] of values.entries()) {
      if (value !== 0n) {
        entries.push(`r${idx.toString().padStart(2, "0")}=0x${value.toString(16)}`);
      }
    }
    return entries.join(" ");
  }
}
