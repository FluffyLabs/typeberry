import { tryAsU64, type U64 } from "@typeberry/numbers";

export interface IHostCallRegisters {
  get(registerIndex: number): U64;
  set(registerIndex: number, value: U64): void;
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

  set(registerIndex: number, value: U64) {
    this.registers[registerIndex] = value;
  }

  getEncoded(): Uint8Array {
    return this.bytes;
  }
}
