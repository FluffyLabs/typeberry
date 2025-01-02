import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { Registers } from "../registers";

export class BitOps {
  constructor(private regs: Registers) {}

  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) | this.regs.getU64(secondIndex));
  }

  orImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) | immediate.getU64());
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) & this.regs.getU64(secondIndex));
  }

  andImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) & immediate.getU64());
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) ^ this.regs.getU64(secondIndex));
  }

  xorImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) ^ immediate.getU64());
  }
}
