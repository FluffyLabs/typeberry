import type { Registers } from "../registers";
import { MAX_SHIFT_U32, MAX_SHIFT_U64 } from "./math-consts";
import { unsignedRightShiftBigInt } from "./math-utils";

export class ShiftOps {
  constructor(private regs: Registers) {}

  shiftLogicalLeftU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternativeU32(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  shiftLogicalLeftU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalLeftImmediateAlternativeU64(firstIndex, this.regs.getU64(secondIndex), resultIndex);
  }

  shiftLogicalRightU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternativeU32(firstIndex, this.regs.getU32(secondIndex), resultIndex);
  }

  shiftLogicalRightU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftLogicalRightImmediateAlternativeU64(firstIndex, this.regs.getU64(secondIndex), resultIndex);
  }

  shiftArithmeticRightU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternativeU32(firstIndex, this.regs.getI32(secondIndex), resultIndex);
  }

  shiftArithmeticRightU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.shiftArithmeticRightImmediateAlternativeU64(firstIndex, this.regs.getI64(secondIndex), resultIndex);
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
    this.regs.setU32(resultIndex, this.regs.getU32(firstIndex) >> (immediateValue % MAX_SHIFT_U32));
  }

  shiftArithmeticRightImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) >> ((0xffn & immediateValue) % MAX_SHIFT_U64));
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
