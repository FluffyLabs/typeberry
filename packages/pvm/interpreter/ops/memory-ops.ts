import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import type { Registers } from "../registers";
import { Result } from "../result";

export class MemoryOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
  ) {}

  sbrk(firstIndex: number, resultIndex: number) {
    try {
      this.regs.setU32(resultIndex, this.memory.sbrk(this.regs.getU32(firstIndex)));
    } catch {
      this.instructionResult.status = Result.FAULT;
    }
  }
}
