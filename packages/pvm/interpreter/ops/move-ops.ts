import type { Registers } from "../registers";

export class MoveOps {
  constructor(private regs: Registers) {}

  cmovIfZeroImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, immediateValue);
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    if (this.regs.getU64(firstIndex) !== 0n) {
      this.regs.setU64(resultIndex, immediateValue);
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex));
    }
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) !== 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex));
    }
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex));
  }
}
