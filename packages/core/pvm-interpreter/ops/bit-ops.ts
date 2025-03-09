import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { Registers } from "../registers";
import { clz64, countBits32, countBits64, ctz32, ctz64 } from "./bit-utils";

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

  andInv(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, ~this.regs.getU64(firstIndex) & this.regs.getU64(secondIndex));
  }

  orInv(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, ~this.regs.getU64(firstIndex) | this.regs.getU64(secondIndex));
  }

  xnor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, ~(this.regs.getU64(firstIndex) ^ this.regs.getU64(secondIndex)));
  }

  countSetBits64(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, countBits64(this.regs.getU64(valueIndex)));
  }

  countSetBits32(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, countBits32(this.regs.getU32(valueIndex)));
  }

  leadingZeroBits64(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, clz64(this.regs.getU64(valueIndex)));
  }

  leadingZeroBits32(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, Math.clz32(this.regs.getU32(valueIndex)));
  }

  trailingZeroBits64(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, ctz64(this.regs.getU64(valueIndex)));
  }

  trailingZeroBits32(valueIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, ctz32(this.regs.getU32(valueIndex)));
  }

  private signExtend(value: number, length: 8 | 16) {
    const mask = 2 ** length - 1;
    const maskedValue = value & mask;
    const bitSign = 1 << (length - 1);

    if ((maskedValue & bitSign) > 0) {
      return ~BigInt(mask) | BigInt(maskedValue);
    }

    return BigInt(maskedValue);
  }

  signExtend8(valueIndex: number, resultIndex: number) {
    const extendedValue = this.signExtend(this.regs.getU32(valueIndex), 8);
    this.regs.setU64(resultIndex, extendedValue);
  }

  signExtend16(valueIndex: number, resultIndex: number) {
    const extendedValue = this.signExtend(this.regs.getU32(valueIndex), 16);
    this.regs.setU64(resultIndex, extendedValue);
  }

  zeroExtend16(valueIndex: number, resultIndex: number) {
    const extendedValue = this.regs.getU64(valueIndex) & 0x00_00_00_00_00_00_ff_ffn;
    this.regs.setU64(resultIndex, extendedValue);
  }
}
