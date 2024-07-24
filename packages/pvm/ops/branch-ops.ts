import { BaseOps } from "./base-ops";

export class BranchOps extends BaseOps {
  private branch(newPc: number, condition: boolean) {
    if (!condition) {
      return;
    }

    // TODO [MaSi] implementation
  }

  jump(offset: number) {
    this.branch(offset, true);
  }

  loadImmediateJump(registerIndex: number, immediate: number, offset: number) {
    this.regs.asUnsigned[registerIndex] = immediate;
    return this.branch(offset, true);
  }

  branchEqImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] === immediate);
  }

  branchEq(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchEqImmediate(firstIndex, this.regs.asUnsigned[secondIndex], offset);
  }

  branchNeImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] !== immediate);
  }

  branchNe(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchNeImmediate(firstIndex, this.regs.asUnsigned[secondIndex], offset);
  }

  branchLtUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] < immediate);
  }

  branchLtUnsigned(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchLtUnsignedImmediate(firstIndex, this.regs.asUnsigned[secondIndex], offset);
  }

  branchLeUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] <= immediate);
  }

  branchGtUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] > immediate);
  }

  branchGeUnsignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asUnsigned[registerIndex] >= immediate);
  }

  branchGeUnsigned(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchGeUnsignedImmediate(firstIndex, this.regs.asUnsigned[secondIndex], offset);
  }

  branchLtSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asSigned[registerIndex] < immediate);
  }

  branchLtSigned(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchLtSignedImmediate(firstIndex, this.regs.asSigned[secondIndex], offset);
  }

  branchLeSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asSigned[registerIndex] <= immediate);
  }

  branchGtSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asSigned[registerIndex] > immediate);
  }

  branchGeSignedImmediate(registerIndex: number, immediate: number, offset: number) {
    return this.branch(offset, this.regs.asSigned[registerIndex] >= immediate);
  }

  branchGeSigned(firstIndex: number, secondIndex: number, offset: number) {
    return this.branchGeSignedImmediate(firstIndex, this.regs.asSigned[secondIndex], offset);
  }
}
