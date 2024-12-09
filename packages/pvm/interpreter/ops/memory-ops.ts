import type { Memory } from "../memory";
import type { Registers } from "../registers";

export class MemoryOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
  ) {}

  sbrk(firstIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.memory.sbrk(this.regs.getU32(firstIndex)));
  }
}
