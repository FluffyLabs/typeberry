import type { Registers } from "../registers";

export class BooleanOps {
  constructor(private regs: Registers) {}

  setLessThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getI32(firstIndex) < immediateValue ? 1 : 0);
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) < immediateValue ? 1 : 0);
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanSignedImmediate(secondIndex, this.regs.getI32(firstIndex), resultIndex);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanUnsignedImmediate(secondIndex, this.regs.getU32(firstIndex), resultIndex);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getI32(firstIndex) > immediateValue ? 1 : 0);
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) > immediateValue ? 1 : 0);
  }
}
