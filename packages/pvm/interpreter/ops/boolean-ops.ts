import type { Registers } from "../registers";

export class BooleanOps {
  constructor(private regs: Registers) {}

  setLessThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex, true) < immediateValue ? 1 : 0);
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) < immediateValue ? 1 : 0);
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanSignedImmediate(secondIndex, this.regs.get(firstIndex, true), resultIndex);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanUnsignedImmediate(secondIndex, this.regs.get(firstIndex), resultIndex);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex, true) > immediateValue ? 1 : 0);
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) > immediateValue ? 1 : 0);
  }
}
