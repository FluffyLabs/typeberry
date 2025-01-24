import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
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
      this.instructionResult.status = Result.TRAP;
      return;
    }

    this.instructionResult.nextPc = nextPc;
  }

  jump(nextPc: number) {
    this.branch(nextPc, true);
  }

  branchEqImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) === immediate.getU64());
  }

  branchEq(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(firstIndex) === this.regs.getU64(secondIndex));
  }

  branchNeImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) !== immediate.getU64());
  }

  branchNe(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(firstIndex) !== this.regs.getU64(secondIndex));
  }

  branchLtUnsignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) < immediate.getU64());
  }

  branchLtUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(firstIndex) < this.regs.getU64(secondIndex));
  }

  branchLeUnsignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) <= immediate.getU64());
  }

  branchGtUnsignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) > immediate.getU64());
  }

  branchGeUnsignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(registerIndex) >= immediate.getU64());
  }

  branchGeUnsigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getU64(firstIndex) >= this.regs.getU64(secondIndex));
  }

  branchLtSignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) < immediate.getI64());
  }

  branchLtSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(firstIndex) < this.regs.getI64(secondIndex));
  }

  branchLeSignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) <= immediate.getI64());
  }

  branchGtSignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) > immediate.getI64());
  }

  branchGeSignedImmediate(registerIndex: number, immediate: ImmediateDecoder, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(registerIndex) >= immediate.getI64());
  }

  branchGeSigned(firstIndex: number, secondIndex: number, nextPc: number) {
    this.branch(nextPc, this.regs.getI64(firstIndex) >= this.regs.getI64(secondIndex));
  }
}
