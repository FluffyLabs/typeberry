import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { ShiftOps } from "./shift-ops";

describe("ShiftOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = Registers.empty();
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    const shiftOps = new ShiftOps(regs);

    return { regs, shiftOps, immediate, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex };
  }

  it("shiftLogicalLeft U32", () => {
    const firstValue = 0b0001n;
    const secondValue = 3n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeft with arg overflow U32", () => {
    const firstValue = 0b0001n;
    const secondValue = 35n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeft with result overflow U32", () => {
    const firstValue = 0xa0_00_00_00n;
    const secondValue = 3n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeft U64", () => {
    const firstValue = 0b0001n;
    const secondValue = 3n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeft with arg overflow U64", () => {
    const firstValue = 0b0001n;
    const secondValue = 67n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeft with result overflow U64", () => {
    const firstValue = 0xa0_00_00_00n;
    const secondValue = 35n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalLeftU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative U32", () => {
    const firstValue = 3n;
    const secondValue = 0b0001n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with arg overflow U32", () => {
    const firstValue = 35n;
    const secondValue = 0b0001n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with result overflow U32", () => {
    const firstValue = 3n;
    const secondValue = 0xa0_00_00_00n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative U64", () => {
    const firstValue = 3n;
    const secondValue = 0b0001n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with arg overflow U64", () => {
    const firstValue = 67n;
    const secondValue = 0b0001n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with result overflow U64", () => {
    const firstValue = 35n;
    const secondValue = 0xa0_00_00_00n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate U32", () => {
    const firstValue = 0b0001n;
    const secondValue = 3n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate with arg overflow U32", () => {
    const firstValue = 0b0001n;
    const secondValue = 35n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate with result overflow U32", () => {
    const firstValue = 0xa0_00_00_00n;
    const secondValue = 3n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate U64", () => {
    const firstValue = 0b0001n;
    const secondValue = 3n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate with arg overflow U64", () => {
    const firstValue = 0b0001n;
    const secondValue = 67n;
    const resultValue = 0b1000n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediate with result overflow U64", () => {
    const firstValue = 0xa0_00_00_00n;
    const secondValue = 35n;
    const resultValue = 0n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalLeftImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRight U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalRightU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRight with arg overflow U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 35n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalRightU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRight U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalRightU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRight with arg overflow U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 67n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftLogicalRightU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediateAlternative U32", () => {
    const firstValue = 3n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with arg overflow U32", () => {
    const firstValue = 35n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediateAlternative U64", () => {
    const firstValue = 3n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalLeftImmediateAlternative with arg overflow U64", () => {
    const firstValue = 67n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediate U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediate with arg overflow U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 35n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediate U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftLogicalRightImmediate with arg overflow U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 67n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftLogicalRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight (positive number) U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight (negative number) U32", () => {
    const firstValue = -8n;
    const secondValue = 3n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight with arg overflow U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 35n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight (positive number) U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight (negative number) U64", () => {
    const firstValue = -8n;
    const secondValue = 3n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRight with arg overflow U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 67n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    shiftOps.shiftArithmeticRightU64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative (positive number) U32", () => {
    const firstValue = 3n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative (negative number) U32", () => {
    const firstValue = 3n;
    const secondValue = -8n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative with arg overflow U32", () => {
    const firstValue = 35n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative (positive number) U64", () => {
    const firstValue = 3n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative (negative number) U64", () => {
    const firstValue = 3n;
    const secondValue = -8n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediateAlternative with arg overflow U64", () => {
    const firstValue = 67n;
    const secondValue = 0b10000n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateAlternativeU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate (positive number) U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate (negative number) U32", () => {
    const firstValue = -8n;
    const secondValue = 3n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate with arg overflow U32", () => {
    const firstValue = 0b10000n;
    const secondValue = 35n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU32(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate (positive number) U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 3n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate (negative number) U64", () => {
    const firstValue = -8n;
    const secondValue = 3n;
    const resultValue = -1n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("shiftArithmeticRightImmediate with arg overflow U64", () => {
    const firstValue = 0b10000n;
    const secondValue = 67n;
    const resultValue = 0b00010n;
    const { regs, shiftOps, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    shiftOps.shiftArithmeticRightImmediateU64(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });
});
