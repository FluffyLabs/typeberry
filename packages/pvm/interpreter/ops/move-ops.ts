import type { Registers } from "../registers";

export class MoveOps {
  constructor(private regs: Registers) {}

  cmovIfZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.regs.get(firstIndex) === 0) {
      this.regs.set(resultIndex, immediateValue);
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.regs.get(firstIndex) !== 0) {
      this.regs.set(resultIndex, immediateValue);
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfZeroImmediate(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfNotZeroImmediate(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex));
  }
}
