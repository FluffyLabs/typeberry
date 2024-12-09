import type { BasicBlocks } from "../basic-blocks";
import type { InstructionResult } from "../instruction-result";
import type { Registers } from "../registers";
import { Result } from "../result";

export class BranchOps {
  constructor(
    private regs: Registers,
    private instructionResult: InstructionResult,
    private basicBlocks: BasicBlocks,
  ) {}

  setBasicBlocks(basicBlocks: BasicBlocks) {
    this.basicBlocks = basicBlocks;
  }

  private branch(nextPc: number, condition: boolean) {
    if (!condition) {
      return;
    }

    if (!this.basicBlocks.isBeginningOfBasicBlock(nextPc)) {
      this.instructionResult.status = Result.PANIC;
      return;
    }

    this.instructionResult.nextPc = nextPc;
  }

  jump(nextPc: number) {
    this.branch(nextPc, true);
  }

  branchEqImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) === immediate);
  }

  branchEq(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchEqImmediate(firstIndex, this.regs.get(secondIndex), nextPc);
  }

  branchNeImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) !== immediate);
  }

  branchNe(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchNeImmediate(firstIndex, this.regs.get(secondIndex), nextPc);
  }

  branchLtUnsignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) < immediate);
  }

  branchLtUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchLtUnsignedImmediate(firstIndex, this.regs.get(secondIndex), nextPc);
  }

  branchLeUnsignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) <= immediate);
  }

  branchGtUnsignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) > immediate);
  }

  branchGeUnsignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex) >= immediate);
  }

  branchGeUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchGeUnsignedImmediate(firstIndex, this.regs.get(secondIndex), nextPc);
  }

  branchLtSignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex, true) < immediate);
  }

  branchLtSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchLtSignedImmediate(firstIndex, this.regs.get(secondIndex, true), nextPc);
  }

  branchLeSignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex, true) <= immediate);
  }

  branchGtSignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex, true) > immediate);
  }

  branchGeSignedImmediate(registerIndex: number, immediate: number, nextPc: number) {
    this.branch(nextPc, this.regs.get(registerIndex, true) >= immediate);
  }

  branchGeSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchGeSignedImmediate(firstIndex, this.regs.get(secondIndex, true), nextPc);
  }
}
