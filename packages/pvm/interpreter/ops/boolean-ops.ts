import type { Registers } from "../registers";

const MASK = 0xffff_ffff_ffff_ffffn;
export class BooleanOps {
  constructor(private regs: Registers) {}

  setLessThanSignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) < immediateValue ? 1n : 0n);
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) < (immediateValue & MASK) ? 1n : 0n);
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(secondIndex) < this.regs.getI64(firstIndex) ? 1n : 0n);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(secondIndex) < this.regs.getU64(firstIndex) ? 1n : 0n);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) > immediateValue ? 1n : 0n);
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) > (immediateValue & MASK) ? 1n : 0n);
  }
}
