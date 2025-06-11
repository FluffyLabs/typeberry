import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import type { Registers } from "../registers.js";

export class BooleanOps {
  constructor(private regs: Registers) {}

  setLessThanSignedImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) < immediate.getI64() ? 1n : 0n);
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) < immediate.getU64() ? 1n : 0n);
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) < this.regs.getI64(secondIndex) ? 1n : 0n);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) < this.regs.getU64(secondIndex) ? 1n : 0n);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) > immediate.getI64() ? 1n : 0n);
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) > immediate.getU64() ? 1n : 0n);
  }
}
