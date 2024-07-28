import type { Context } from "../context";
import { BaseOps } from "./base-ops";
import { MAX_SHIFT } from "./math-consts";

export class ShiftOps extends BaseOps<Pick<Context, "regs">> {
  shiftLogicalLeft(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternative(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  shiftLogicalRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternative(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  shiftArithmeticRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternative(firstIndex, this.ctx.regs.asSigned[secondIndex], resultIndex);
  }

  shiftLogicalLeftImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] << (immediateValue % MAX_SHIFT);
  }

  shiftLogicalRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] >>> (immediateValue % MAX_SHIFT);
  }

  shiftArithmeticRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] >> (immediateValue % MAX_SHIFT);
  }

  shiftLogicalLeftImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = immediateValue << (this.ctx.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }

  shiftLogicalRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = immediateValue >>> (this.ctx.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }

  shiftArithmeticRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asSigned[resultIndex] = immediateValue >> (this.ctx.regs.asUnsigned[firstIndex] % MAX_SHIFT);
  }
}
