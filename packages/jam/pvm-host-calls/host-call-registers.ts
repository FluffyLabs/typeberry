import { type U64, tryAsU64 } from "@typeberry/numbers";
import type { Registers } from "@typeberry/pvm-interpreter";

export class HostCallRegisters {
  constructor(private readonly registers: Registers) {}

  get(registerIndex: number): U64 {
    return tryAsU64(this.registers.getU64(registerIndex));
  }

  set(registerIndex: number, value: U64) {
    this.registers.setU64(registerIndex, value);
  }
}
