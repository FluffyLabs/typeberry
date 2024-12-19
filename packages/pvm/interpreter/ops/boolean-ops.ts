import type { Registers } from "../registers";

export class BooleanOps {
  constructor(private regs: Registers) {}

  setLessThanSignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) < immediateValue ? 1n : 0n);
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) < immediateValue ? 1n : 0n);
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanSignedImmediate(secondIndex, this.regs.getI64(firstIndex), resultIndex);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanUnsignedImmediate(secondIndex, this.regs.getU64(firstIndex), resultIndex);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) > immediateValue ? 1n : 0n);
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) > immediateValue ? 1n : 0n);
  }
}
