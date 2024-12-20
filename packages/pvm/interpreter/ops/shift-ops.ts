import type { Registers } from "../registers";
import { MAX_SHIFT_U32, MAX_SHIFT_U64 } from "./math-consts";
import { unsignedRightShiftBigInt } from "./math-utils";

export class ShiftOps {
  constructor(private regs: Registers) {}

  shiftLogicalLeftU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(secondIndex) << (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftLogicalLeftU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(secondIndex) << ((0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64));
  }

  shiftLogicalRightU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(secondIndex) >>> (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftLogicalRightU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      unsignedRightShiftBigInt(this.regs.getU64(secondIndex), (0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64),
    );
  }

  shiftArithmeticRightU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI32(resultIndex, this.regs.getI32(secondIndex) >> (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftArithmeticRightU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(resultIndex, this.regs.getI64(secondIndex) >> ((0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64));
  }

  shiftLogicalLeftImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) << (immediateValue % MAX_SHIFT_U32));
  }

  shiftLogicalLeftImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) << ((0xffn & immediateValue) % MAX_SHIFT_U64));
  }

  shiftLogicalRightImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) >>> (immediateValue % MAX_SHIFT_U32));
  }

  shiftLogicalRightImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      unsignedRightShiftBigInt(this.regs.getU64(firstIndex), (0xffn & immediateValue) % MAX_SHIFT_U64),
    );
  }

  shiftArithmeticRightImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, this.regs.getI32(firstIndex) >> (immediateValue % MAX_SHIFT_U32));
  }

  shiftArithmeticRightImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getI64(firstIndex) >> ((0xffn & immediateValue) % MAX_SHIFT_U64));
  }

  shiftLogicalLeftImmediateAlternativeU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, immediateValue << (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftLogicalLeftImmediateAlternativeU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, BigInt(immediateValue) << ((0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64));
  }

  shiftLogicalRightImmediateAlternativeU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, immediateValue >>> (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftLogicalRightImmediateAlternativeU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      unsignedRightShiftBigInt(immediateValue, (0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64),
    );
  }

  shiftArithmeticRightImmediateAlternativeU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setI32(resultIndex, immediateValue >> (this.regs.getU32(firstIndex) % MAX_SHIFT_U32));
  }

  shiftArithmeticRightImmediateAlternativeU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setI64(resultIndex, immediateValue >> ((0xffn & this.regs.getU64(firstIndex)) % MAX_SHIFT_U64));
  }
}
