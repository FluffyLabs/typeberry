import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { MathOps } from "./math-ops";

describe("MathOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = new Registers();
    const firstValRegIndex = 0;
    const secondValRegIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstValRegIndex, firstValue);
    regs.setU64(secondValRegIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(firstValue));

    const mathOps = new MathOps(regs);

    return { regs, mathOps, immediate, firstValRegIndex, secondValRegIndex, resultRegisterIndex };
  }

  it("add U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 25n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.addU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("add with overflow U32", () => {
    const firstValue = 2n ** 32n - 1n;
    const secondValue = 13n;
    const resultValue = 12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.addU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("addImmediateU32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 25n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.addImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("addImmediateU64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 25n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.addImmediateU64(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("addImmediate with overflow U32", () => {
    const firstValue = 2n ** 32n - 1n;
    const secondValue = 13n;
    const resultValue = 12n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.addImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("sub", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.subU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("sub U64", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.subU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("sub with overflow U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.subU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("sub with overflow U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.subU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("negAddImmediate U32", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 1n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.negAddImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("negAddImmediate U64", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 1n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.negAddImmediateU64(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("negAddImmediate with overflow U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.negAddImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("negAddImmediate with overflow U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.negAddImmediateU64(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mul U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mul U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mul with overflow U32", () => {
    const firstValue = 2n ** 17n + 1n;
    const secondValue = 2n ** 18n;
    const resultValue = 262144n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mul with overflow U64", () => {
    const firstValue = 2n ** 57n + 1n;
    const secondValue = 2n ** 58n;
    const resultValue = 288230376151711744n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulImmediate U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulImmediate U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulImmediateU64(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulImmediate with overflow U32", () => {
    const firstValue = 2n ** 17n + 1n;
    const secondValue = 2n ** 18n;
    const resultValue = 262144n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulImmediateU32(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulImmediate with overflow U64", () => {
    const firstValue = 2n ** 64n - 1n;
    const secondValue = 2n ** 18n;
    const resultValue = 18446744073709289472n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulImmediateU64(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulUpperUUImmediate", () => {
    const firstValue = 2n ** 30n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 26n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperUUImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulUpperUUImmediate (max unsigned value)", () => {
    const firstValue = 2n ** 32n - 1n;
    const secondValue = 2n ** 64n - 1n;
    const resultValue = 2n ** 64n - 2n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperUUImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulUpperUU", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperUU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulUpperUU (max unsigned value)", () => {
    const firstValue = 2n ** 64n - 1n;
    const secondValue = 2n ** 64n - 1n;
    const resultValue = 2n ** 64n - 2n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperUU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSSImmediate (positive numbers)", () => {
    const firstValue = 2n ** 30n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 26n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperSSImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSSImmediate (negative numbers)", () => {
    const firstValue = -(2n ** 30n);
    const secondValue = -(2n ** 60n);
    const resultValue = 2n ** 26n;
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperSSImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSSImmediate (positive and negative)", () => {
    const firstValue = 2n ** 30n;
    const secondValue = -(2n ** 60n);
    const resultValue = -(2n ** 26n);
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperSSImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSSImmediate (negative and positive)", () => {
    const firstValue = -(2n ** 30n);
    const secondValue = 2n ** 60n;
    const resultValue = -(2n ** 26n);
    const { regs, mathOps, secondValRegIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    mathOps.mulUpperSSImmediate(secondValRegIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSS (positive numbers)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSS(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSS (negative numbers)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = -(2n ** 60n);
    const resultValue = 2n ** 56n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSS(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSS (positive and negative)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = -(2n ** 60n);
    const resultValue = -(2n ** 56n);
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSS(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSS (negative and positive)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = 2n ** 30n;
    const resultValue = -(2n ** 26n);
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSS(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSU (positive numbers)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSU (negative and positive)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = 2n ** 60n;
    const resultValue = -(2n ** 56n);
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("mulUpperSU (a case from test vectors)", () => {
    const firstValue = 0xffffffff80000000n;
    const secondValue = 0xffffffffffff8000n;
    const resultValue = 0xffffffff80000000n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.mulUpperSU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned U32", () => {
    const firstValue = 26n;
    const secondValue = 2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned U64", () => {
    const firstValue = 26n;
    const secondValue = 2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned (rounding) U32", () => {
    const firstValue = 25n;
    const secondValue = 2n;
    const resultValue = 12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned (rounding) U64", () => {
    const firstValue = 25n;
    const secondValue = 2n;
    const resultValue = 12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned (by zero) U32", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divUnsigned (by zero) U64", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = 2n ** 64n - 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divUnsignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("divSigned (positive numbers) U32", () => {
    const firstValue = 26n;
    const secondValue = 2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (positive numbers) U64", () => {
    const firstValue = 26n;
    const secondValue = 2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (negative numbers) U32", () => {
    const firstValue = -26n;
    const secondValue = -2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (negative numbers) U64", () => {
    const firstValue = -26n;
    const secondValue = -2n;
    const resultValue = 13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (positive and negative numbers) U32", () => {
    const firstValue = -26n;
    const secondValue = 2n;
    const resultValue = -13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (positive and negative numbers) U64", () => {
    const firstValue = -26n;
    const secondValue = 2n;
    const resultValue = -13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (negative and positive numbers) U32", () => {
    const firstValue = 26n;
    const secondValue = -2n;
    const resultValue = -13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (negative and positive numbers) U64", () => {
    const firstValue = 26n;
    const secondValue = -2n;
    const resultValue = -13n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (rounding positive number) U32", () => {
    const firstValue = 25n;
    const secondValue = 2n;
    const resultValue = 12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (rounding positive number) U64", () => {
    const firstValue = 25n;
    const secondValue = 2n;
    const resultValue = 12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (rounding negative number) U32", () => {
    const firstValue = -25n;
    const secondValue = 2n;
    const resultValue = -12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (rounding negative number) U64", () => {
    const firstValue = -25n;
    const secondValue = 2n;
    const resultValue = -12n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (by zero) U32", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = -1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned (by zero) U64", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = -1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned with overflow U32", () => {
    const firstValue = -(2n ** 31n);
    const secondValue = -1n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("divSigned with overflow U64", () => {
    const firstValue = -(2n ** 63n);
    const secondValue = -1n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.divSignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("remUnsigned U32", () => {
    const firstValue = 26n;
    const secondValue = 5n;
    const resultValue = 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.remUnsignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("remUnsigned U64", () => {
    const firstValue = 26n;
    const secondValue = 5n;
    const resultValue = 1n;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.remUnsignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("remUnsigned (by zero) U32", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.remUnsignedU32(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("remUnsigned (by zero) U64", () => {
    const firstValue = 25n;
    const secondValue = 0n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.remUnsignedU64(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate min value (positive numbers)", () => {
    const firstValue = 1n;
    const secondValue = 25n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.min(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate min value (negative numbers)", () => {
    const firstValue = -1n;
    const secondValue = -25n;
    const resultValue = secondValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.min(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("should calculate minU value (positive numbers)", () => {
    const firstValue = 1n;
    const secondValue = 25n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.minU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate minU value (negative numbers)", () => {
    const firstValue = 0n;
    const secondValue = -25n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.minU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate max value (positive numbers)", () => {
    const firstValue = 1n;
    const secondValue = 25n;
    const resultValue = secondValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.max(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate max value (negative numbers)", () => {
    const firstValue = -1n;
    const secondValue = -25n;
    const resultValue = firstValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.max(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });

  it("should calculate maxU value (positive numbers)", () => {
    const firstValue = 1n;
    const secondValue = 25n;
    const resultValue = secondValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.maxU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("should calculate maxU value (negative numbers)", () => {
    const firstValue = 0n;
    const secondValue = -25n;
    const resultValue = secondValue;
    const { regs, mathOps, firstValRegIndex, secondValRegIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    mathOps.maxU(firstValRegIndex, secondValRegIndex, resultRegisterIndex);

    assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
  });
});
