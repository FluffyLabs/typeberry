import type { Memory } from "../memory";
import type { Registers } from "../registers";

export class MemoryOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
  ) {}

  sbrk(firstIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, this.memory.sbrk(this.regs.get(firstIndex)));
  }
}
