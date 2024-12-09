import type { Registers } from "../registers";

export class BitOps {
  constructor(private regs: Registers) {}

  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.orImmediate(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) | immediateValue);
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.andImmediate(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  andImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) & immediateValue);
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.xorImmediate(firstIndex, this.regs.get(secondIndex), resultIndex);
  }

  xorImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, this.regs.get(firstIndex) ^ immediateValue);
  }
}
