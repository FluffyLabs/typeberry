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

  branchEqImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) === immediate);
  }

  branchEq(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchEqImmediate(firstIndex, this.regs.getU64(secondIndex), nextPc);
  }

  branchNeImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) !== immediate);
  }

  branchNe(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchNeImmediate(firstIndex, this.regs.getU64(secondIndex), nextPc);
  }

  branchLtUnsignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) < immediate);
  }

  branchLtUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchLtUnsignedImmediate(firstIndex, this.regs.getU64(secondIndex), nextPc);
  }

  branchLeUnsignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) <= immediate);
  }

  branchGtUnsignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) > immediate);
  }

  branchGeUnsignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) >= immediate);
  }

  branchGeUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchGeUnsignedImmediate(firstIndex, this.regs.getU64(secondIndex), nextPc);
  }

  branchLtSignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) < immediate);
  }

  branchLtSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchLtSignedImmediate(firstIndex, this.regs.getI64(secondIndex), nextPc);
  }

  branchLeSignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) <= immediate);
  }

  branchGtSignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) > immediate);
  }

  branchGeSignedImmediate(registerIndex: number, immediate: bigint, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) >= immediate);
  }

  branchGeSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branchGeSignedImmediate(firstIndex, this.regs.getI64(secondIndex), nextPc);
  }
}
