import { BaseOps } from "./base-ops";
import { MAX_SHIFT } from "./math-consts";

export class ShiftOps extends BaseOps<"regs"> {
  shiftLogicalLeft(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternative(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  shiftLogicalRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternative(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  shiftArithmeticRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternative(firstIndex, this.context.regs.asSigned[secondIndex], resultIndex);
  }

  shiftLogicalLeftImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] =
      this.context.regs.asUnsigned[firstIndex] << (immediateValue % MAX_SHIFT);
  }

  shiftLogicalRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] =
      this.context.regs.asUnsigned[firstIndex] >>> (immediateValue % MAX_SHIFT);
  }

  shiftArithmeticRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] =
      this.context.regs.asUnsigned[firstIndex] >> (immediateValue % MAX_SHIFT);
  }

  shiftLogicalLeftImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] =
      immediateValue << (this.context.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }

  shiftLogicalRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] =
      immediateValue >>> (this.context.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }

  shiftArithmeticRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asSigned[resultIndex] = immediateValue >> (this.context.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }
}
