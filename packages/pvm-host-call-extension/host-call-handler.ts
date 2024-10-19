import type { Memory } from "@typeberry/pvm/memory";
import type { Registers } from "@typeberry/pvm/registers";

export interface HostCallHandler {
  execute(gas: number, regs: Registers, memory: Memory): void;
}
