import { type Registers, signExtend32To64 } from "../registers";

export class BitOps {
  constructor(private regs: Registers) {}

  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.orImmediate(firstIndex, this.regs.getU64(secondIndex), resultIndex);
  }

  orImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) | signExtend32To64(immediateValue));
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.andImmediate(firstIndex, this.regs.getU64(secondIndex), resultIndex);
  }

  andImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) & signExtend32To64(immediateValue));
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.xorImmediate(firstIndex, this.regs.getU64(secondIndex), resultIndex);
  }

  xorImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) ^ signExtend32To64(immediateValue));
  }
}
