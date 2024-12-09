import type { Registers } from "../registers";
import { MAX_SHIFT } from "./math-consts";

export class ShiftOps {
  constructor(private regs: Registers) {}

  shiftLogicalLeft(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternative(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  shiftLogicalRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternative(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  shiftArithmeticRight(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternative(firstIndex, this.regs.get(secondIndex, true), resultIndex);
  }

  shiftLogicalLeftImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) << (immediateValue % MAX_SHIFT));
  }

  shiftLogicalRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) >>> (immediateValue % MAX_SHIFT));
  }

  shiftArithmeticRightImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) >> (immediateValue % MAX_SHIFT));
  }

  shiftLogicalLeftImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, immediateValue << (this.regs.get(firstIndex) % MAX_SHIFT));
  }

  shiftLogicalRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, immediateValue >>> (this.regs.get(firstIndex) % MAX_SHIFT));
  }

  shiftArithmeticRightImmediateAlternative(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, immediateValue >> (this.regs.get(firstIndex) % MAX_SHIFT), true);
  }
}
