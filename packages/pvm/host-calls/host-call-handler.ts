import type { Memory } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";

export interface HostCallHandler {
  execute(gas: number, regs: Registers, memory: Memory): Promise<void>;
}
