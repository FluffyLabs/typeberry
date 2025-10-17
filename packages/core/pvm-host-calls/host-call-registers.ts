import { tryAsU64, type U64 } from "@typeberry/numbers";
import type { IRegisters } from "@typeberry/pvm-interface/registers.js";
import type { Registers } from "@typeberry/pvm-interpreter";

export class HostCallRegisters implements IRegisters {
  constructor(private readonly registers: Registers) {}

  get(registerIndex: number): U64 {
    return tryAsU64(this.registers.getU64(registerIndex));
  }

  set(registerIndex: number, value: U64) {
    this.registers.setU64(registerIndex, value);
  }
}
