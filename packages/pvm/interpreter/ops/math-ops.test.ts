import assert from "node:assert";
import { test } from "node:test";

import { Registers } from "../registers";
import { MathOps } from "./math-ops";

const FIRST_REGISTER = 0;
const SECOND_REGISTER = 1;
const RESULT_REGISTER = 12;

const getRegisters = (data: bigint[]) => {
  const regs = new Registers();

  for (const [i, byte] of data.entries()) {
    regs.setU64(i, byte);
  }

  return regs;
};

test("MathOps", async (t) => {
  await t.test("add U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 25n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.addU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("add with overflow U32", () => {
    const firstValue = 2n ** 32n - 1n;
    const secondValue = 13n;
    const resultValue = 12n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.addU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("addImmediateU32", () => {
    const firstValue = 12n;
    const secondValue = 13;
    const resultValue = 25n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.addImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("addImmediateU64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 25n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.addImmediateU64(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("addImmediate with overflow U32", () => {
    const firstValue = 2n ** 32n - 1n;
    const secondValue = 13;
    const resultValue = 12n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.addImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("sub", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.subU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("sub U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.subU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("sub with overflow U32", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.subU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("sub with overflow U64", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.subU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("negAddImmediate U32", () => {
    const firstValue = 12n;
    const secondValue = 13;
    const resultValue = 1n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.negAddImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("negAddImmediate U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 1n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.negAddImmediateU64(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("negAddImmediate with overflow U32", () => {
    const firstValue = 13n;
    const secondValue = 12;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.negAddImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("negAddImmediate with overflow U64", () => {
    const firstValue = 13n;
    const secondValue = 12n;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.negAddImmediateU64(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mul U32", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mul U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mul with overflow U32", () => {
    const firstValue = 2n ** 17n + 1n;
    const secondValue = 2n ** 18n;
    const resultValue = 262144n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mul with overflow U64", () => {
    const firstValue = 2n ** 57n + 1n;
    const secondValue = 2n ** 58n;
    const resultValue = 288230376151711744n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulImmediate U32", () => {
    const firstValue = 12n;
    const secondValue = 13;
    const resultValue = 156n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulImmediate U64", () => {
    const firstValue = 12n;
    const secondValue = 13n;
    const resultValue = 156n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulImmediateU64(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulImmediate with overflow U32", () => {
    const firstValue = 2n ** 17n + 1n;
    const secondValue = 2 ** 18;
    const resultValue = 262144n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulImmediateU32(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulImmediate with overflow U64", () => {
    const firstValue = 2n ** 64n - 1n;
    const secondValue = 2n ** 18n;
    const resultValue = 18446744073709289472n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulImmediateU64(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperUUImmediate", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2 ** 30;
    const resultValue = 2n ** 26n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulUpperUUImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperUUImmediate (max unsigned value)", () => {
    const firstValue = 2n ** 64n - 1n;
    const secondValue = 2 ** 32 - 1;
    const resultValue = 2n ** 64n - 2n;
    const regs = getRegisters([firstValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulUpperUUImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperUU", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulUpperUU(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperUU (max unsigned value)", () => {
    const firstValue = 2n ** 64n - 1n;
    const secondValue = 2n ** 64n - 1n;
    const resultValue = 2n ** 64n - 2n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.mulUpperUU(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSSImmediate (positive numbers)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2 ** 30;
    const resultValue = 2n ** 26n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSSImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSSImmediate (negative numbers)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = -(2 ** 30);
    const resultValue = 2n ** 26n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSSImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSSImmediate (positive and negative)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = -(2 ** 30);
    const resultValue = -(2n ** 26n);
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSSImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSSImmediate (negative and positive)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = 2 ** 30;
    const resultValue = -(2n ** 26n);
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSSImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSS (positive numbers)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSS(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSS (negative numbers)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = -(2n ** 60n);
    const resultValue = 2n ** 56n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSS(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSS (positive and negative)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = -(2n ** 60n);
    const resultValue = -(2n ** 56n);
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSS(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSS (negative and positive)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = 2n ** 30n;
    const resultValue = -(2n ** 26n);
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSS(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSU (positive numbers)", () => {
    const firstValue = 2n ** 60n;
    const secondValue = 2n ** 60n;
    const resultValue = 2n ** 56n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setU64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSU(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("mulUpperSU (negative and positive)", () => {
    const firstValue = -(2n ** 60n);
    const secondValue = 2n ** 60n;
    const resultValue = -(2n ** 56n);
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setU64(SECOND_REGISTER, secondValue);

    const mathOps = new MathOps(regs);

    mathOps.mulUpperSU(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned U32", () => {
    const firstValue = 2n;
    const secondValue = 26n;
    const resultValue = 13n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned U64", () => {
    const firstValue = 2n;
    const secondValue = 26n;
    const resultValue = 13n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned (rounding) U32", () => {
    const firstValue = 2n;
    const secondValue = 25n;
    const resultValue = 12n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned (rounding) U64", () => {
    const firstValue = 2n;
    const secondValue = 25n;
    const resultValue = 12n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned (by zero) U32", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divUnsigned (by zero) U64", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = 2n ** 64n - 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.divUnsignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (positive numbers) U32", () => {
    const firstValue = 2n;
    const secondValue = 26n;
    const resultValue = 13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (positive numbers) U64", () => {
    const firstValue = 2n;
    const secondValue = 26n;
    const resultValue = 13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (negative numbers) U32", () => {
    const firstValue = -2n;
    const secondValue = -26n;
    const resultValue = 13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (negative numbers) U64", () => {
    const firstValue = -2n;
    const secondValue = -26n;
    const resultValue = 13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (positive and negative numbers) U32", () => {
    const firstValue = 2n;
    const secondValue = -26n;
    const resultValue = -13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (positive and negative numbers) U64", () => {
    const firstValue = 2n;
    const secondValue = -26n;
    const resultValue = -13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (negative and positive numbers) U32", () => {
    const firstValue = -2n;
    const secondValue = 26n;
    const resultValue = -13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (negative and positive numbers) U64", () => {
    const firstValue = -2n;
    const secondValue = 26n;
    const resultValue = -13n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (rounding positive number) U32", () => {
    const firstValue = 2n;
    const secondValue = 25n;
    const resultValue = 12n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (rounding positive number) U64", () => {
    const firstValue = 2n;
    const secondValue = 25n;
    const resultValue = 12n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (rounding negative number) U32", () => {
    const firstValue = 2n;
    const secondValue = -25n;
    const resultValue = -12n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (rounding negative number) U64", () => {
    const firstValue = 2n;
    const secondValue = -25n;
    const resultValue = -12n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (by zero) U32", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = -1n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned (by zero) U64", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = -1n;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned with overflow U32", () => {
    const firstValue = -1n;
    const secondValue = -(2n ** 31n);
    const resultValue = secondValue;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("divSigned with overflow U64", () => {
    const firstValue = -1n;
    const secondValue = -(2n ** 63n);
    const resultValue = secondValue;
    const regs = new Registers();
    regs.setI64(FIRST_REGISTER, firstValue);
    regs.setI64(SECOND_REGISTER, secondValue);
    const mathOps = new MathOps(regs);

    mathOps.divSignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getI64(RESULT_REGISTER), resultValue);
  });

  await t.test("remUnsigned U32", () => {
    const firstValue = 5n;
    const secondValue = 26n;
    const resultValue = 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.remUnsignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("remUnsigned U64", () => {
    const firstValue = 5n;
    const secondValue = 26n;
    const resultValue = 1n;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.remUnsignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("remUnsigned (by zero) U32", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = secondValue;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.remUnsignedU32(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("remUnsigned (by zero) U64", () => {
    const firstValue = 0n;
    const secondValue = 25n;
    const resultValue = secondValue;
    const regs = getRegisters([firstValue, secondValue]);
    const mathOps = new MathOps(regs);

    mathOps.remUnsignedU64(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });
});
