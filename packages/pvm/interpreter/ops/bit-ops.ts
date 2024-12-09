import type { Registers } from "../registers";

export class BitOps {
  constructor(private regs: Registers) {}

  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.orImmediate(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) | immediateValue);
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.andImmediate(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  andImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) & immediateValue);
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.xorImmediate(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  xorImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) ^ immediateValue);
  }
}
