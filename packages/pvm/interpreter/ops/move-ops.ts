import type { Registers } from "../registers";

export class MoveOps {
  constructor(private regs: Registers) {}

  cmovIfZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU32(resultIndex, immediateValue);
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) !== 0) {
      this.regs.setU32(resultIndex, immediateValue);
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfZeroImmediate(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfNotZeroImmediate(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex));
  }
}
