import { BaseOps } from "./base-ops";

export class MoveOps extends BaseOps<"regs"> {
  cmovIfZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] === 0) {
      this.context.regs.asUnsigned[resultIndex] = immediateValue;
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] !== 0) {
      this.context.regs.asUnsigned[resultIndex] = immediateValue;
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfZeroImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfNotZeroImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex];
  }
}
