import { tryAsU64, type U64 } from "@typeberry/numbers";
import type { IRegisters } from "@typeberry/pvm-interface/registers.js";

export interface IHostCallRegisters {
  get(registerIndex: number): U64;
  set(registerIndex: number, value: U64): void;
  getEncoded(): Uint8Array;
}

// TODO [MaSo] Delte in favor of IRegister
export class HostCallRegisters implements IHostCallRegisters {
  constructor(private readonly registers: IRegisters) {}

  get(registerIndex: number): U64 {
    return tryAsU64(this.registers.get(registerIndex));
  }

  set(registerIndex: number, value: U64) {
    this.registers.set(registerIndex, value);
  }

  getEncoded(): Uint8Array {
    return this.registers.getAllEncoded();
  }
}
