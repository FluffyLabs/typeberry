import type { InstructionResult } from "../instruction-result.js";
import type { Memory } from "../memory/index.js";
import type { Registers } from "../registers.js";
import { Result } from "../result.js";

export class MemoryOps {
  static new(regs: Registers, memory: Memory, instructionResult: InstructionResult) {
    return new MemoryOps(regs, memory, instructionResult);
  }

  private constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
  ) {}

  sbrk(firstIndex: number, resultIndex: number) {
    try {
      this.regs.setU32(resultIndex, this.memory.sbrk(this.regs.getLowerU32(firstIndex)));
    } catch {
      this.instructionResult.status = Result.FAULT;
    }
  }
}
