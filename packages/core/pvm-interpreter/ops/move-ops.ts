import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { Registers } from "../registers";

export class MoveOps {
  constructor(private regs: Registers) {}

  cmovIfZeroImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, immediate.getU64());
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    if (this.regs.getU64(firstIndex) !== 0n) {
      this.regs.setU64(resultIndex, immediate.getU64());
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
    }
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) !== 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
    }
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
  }
}
