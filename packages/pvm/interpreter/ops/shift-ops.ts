import type { Registers } from "../registers";
import { MAX_SHIFT } from "./math-consts";

export class ShiftOps {
  constructor(private regs: Registers) {}

  shiftLogicalLeft(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternative(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  shiftLogicalRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternative(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  shiftArithmeticRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternative(firstIndex, this.regs.getI32(secondIndex), resultIndex);
  }

  shiftLogicalLeftImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) << (immediateValue % MAX_SHIFT));
  }

  shiftLogicalRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) >>> (immediateValue % MAX_SHIFT));
  }

  shiftArithmeticRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) >> (immediateValue % MAX_SHIFT));
  }

  shiftLogicalLeftImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, immediateValue << (this.regs.getU32(firstIndex) % MAX_SHIFT));
  }

  shiftLogicalRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, immediateValue >>> (this.regs.getU32(firstIndex) % MAX_SHIFT));
  }

  shiftArithmeticRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setI32(resultIndex, immediateValue >> (this.regs.getU32(firstIndex) % MAX_SHIFT));
  }
}
