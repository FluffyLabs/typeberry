import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { Registers } from "../registers";
import { unsignedRightShiftBigInt } from "./math-utils";

export class BitRotationOps {
  constructor(private regs: Registers) {}

  reverseBytes(valueIndex: number, resultIndex: number) {
    const value = this.regs.getU64(valueIndex);
    let reversedValue = 0n;

    for (let i = 0; i < 8; i++) {
      const byte = (value >> BigInt(i * 8)) & 0xffn;
      reversedValue = (reversedValue << 8n) | byte;
    }

    this.regs.setU64(resultIndex, reversedValue);
  }

  private rotate32Left(value: number, shift: number) {
    const shiftNormalized = shift % 32;
    const mask = 2 ** 32 - 1;
    const rotated = (((value << shiftNormalized) & mask) | (value >>> (32 - shiftNormalized))) >>> 0;
    return rotated & mask;
  }

  private rotate64Left(value: bigint, shift: number) {
    const shiftNormalized = shift % 64;
    const mask = (1n << 64n) - 1n;
    const rotated =
      ((value << BigInt(shiftNormalized)) & mask) | unsignedRightShiftBigInt(value, BigInt(64 - shiftNormalized));
    return rotated & mask;
  }

  private rotate32Right(value: number, shift: number) {
    const shiftNormalized = shift % 32;
    const mask = 2 ** 32 - 1;
    const rotated = (value >>> shiftNormalized) | ((value << (32 - shiftNormalized)) & mask);
    return rotated & mask;
  }

  private rotate64Right(value: bigint, shift: number) {
    const shiftNormalized = shift % 64;
    const mask = (1n << 64n) - 1n;
    const rotated =
      unsignedRightShiftBigInt(value, BigInt(shiftNormalized)) | ((value << BigInt(64 - shiftNormalized)) & mask);
    return rotated & mask;
  }

  rotR64Imm(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    const shift = immediate.getU32();
    const value = this.regs.getU64(firstIndex);
    this.regs.setU64(resultIndex, this.rotate64Right(value, shift));
  }

  rotR64ImmAlt(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = immediate.getU64();
    this.regs.setU64(resultIndex, this.rotate64Right(value, shift));
  }

  rotR32Imm(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    const shift = immediate.getU32();
    const value = this.regs.getU32(firstIndex);
    this.regs.setU32(resultIndex, this.rotate32Right(value, shift));
  }

  rotR32ImmAlt(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = immediate.getU32();
    this.regs.setU32(resultIndex, this.rotate32Right(value, shift));
  }

  rotL64(firstIndex: number, secondIndex: number, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = this.regs.getU64(secondIndex);
    this.regs.setU64(resultIndex, this.rotate64Left(value, shift));
  }

  rotL32(firstIndex: number, secondIndex: number, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = this.regs.getU32(secondIndex);
    this.regs.setU32(resultIndex, this.rotate32Left(value, shift));
  }

  rotR64(firstIndex: number, secondIndex: number, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = this.regs.getU64(secondIndex);
    this.regs.setU64(resultIndex, this.rotate64Right(value, shift));
  }

  rotR32(firstIndex: number, secondIndex: number, resultIndex: number) {
    const shift = this.regs.getU32(firstIndex);
    const value = this.regs.getU32(secondIndex);
    this.regs.setU32(resultIndex, this.rotate32Right(value, shift));
  }
}
