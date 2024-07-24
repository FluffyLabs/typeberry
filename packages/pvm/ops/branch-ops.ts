import { BaseOps } from "./base-ops";

export class BranchOps extends BaseOps<"regs" | "pc" | "nextPc"> {
  private branch(nextPc: number, condition: boolean) {
    if (!condition) {
      return;
    }

    this.context.nextPc = this.context.pc + nextPc;
  }

  jump(offset: number) {
    this.branch(offset, true);
  }

  loadImmediateJump(registerIndex: number, immediate: number, offset: number) {
    this.context.regs.asUnsigned[registerIndex] = immediate;
    this.branch(offset, true);
  }

  branchEqImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] === immediate);
  }

  branchEq(firstIndex: number, secondIndex: number, offset: number) {
    this.branchEqImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], offset);
  }

  branchNeImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] !== immediate);
  }

  branchNe(firstIndex: number, secondIndex: number, offset: number) {
    this.branchNeImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], offset);
  }

  branchLtUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] < immediate);
  }

  branchLtUnsigned(firstIndex: number, secondIndex: number, offset: number) {
    this.branchLtUnsignedImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], offset);
  }

  branchLeUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] <= immediate);
  }

  branchGtUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] > immediate);
  }

  branchGeUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asUnsigned[registerIndex] >= immediate);
  }

  branchGeUnsigned(firstIndex: number, secondIndex: number, offset: number) {
    this.branchGeUnsignedImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], offset);
  }

  branchLtSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asSigned[registerIndex] < immediate);
  }

  branchLtSigned(firstIndex: number, secondIndex: number, offset: number) {
    this.branchLtSignedImmediate(firstIndex, this.context.regs.asSigned[secondIndex], offset);
  }

  branchLeSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asSigned[registerIndex] <= immediate);
  }

  branchGtSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asSigned[registerIndex] > immediate);
  }

  branchGeSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    this.branch(offset, this.context.regs.asSigned[registerIndex] >= immediate);
  }

  branchGeSigned(firstIndex: number, secondIndex: number, offset: number) {
    this.branchGeSignedImmediate(firstIndex, this.context.regs.asSigned[secondIndex], offset);
  }
}
