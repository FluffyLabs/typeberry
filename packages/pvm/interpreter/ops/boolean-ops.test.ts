import assert from "node:assert";
import { test } from "node:test";

import { Registers } from "../registers";
import { BooleanOps } from "./boolean-ops";

const FIRST_REGISTER = 0;
const RESULT_REGISTER = 1;
const SECOND_REGISTER = 2;
const getRegisters = (data: number[]) => {
  const regs = new Registers();

  for (const [i, byte] of data.entries()) {
    regs.setU32(i, byte);
  }

  return regs;
};

test("BooleanOps", async (t) => {
  await t.test("setLessThanUnsignedImmediate - true", () => {
    const firstValue = 1;
    const secondValue = 2n;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = getRegisters([firstValue, initialResultRegister]);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanUnsignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanUnsignedImmediate - false", () => {
    const firstValue = 3;
    const secondValue = 2n;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = getRegisters([firstValue, initialResultRegister]);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanUnsignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setGreaterThanUnsignedImmediate - true", () => {
    const firstValue = 3;
    const secondValue = 2n;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = getRegisters([firstValue, initialResultRegister]);
    const bitOps = new BooleanOps(regs);

    bitOps.setGreaterThanUnsignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setGreaterThanUnsignedImmediate - false", () => {
    const firstValue = 1;
    const secondValue = 2n;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = getRegisters([firstValue, initialResultRegister]);
    const bitOps = new BooleanOps(regs);

    bitOps.setGreaterThanUnsignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanSignedImmediate - true", () => {
    const firstValue = -3;
    const secondValue = -2n;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanSignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanSignedImmediate - false", () => {
    const firstValue = -1;
    const secondValue = -2n;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanSignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setGreaterThanSignedImmediate - true", () => {
    const firstValue = -1;
    const secondValue = -2n;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setGreaterThanSignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setGreaterThanSignedImmediate - false", () => {
    const firstValue = -3;
    const secondValue = -2n;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setGreaterThanSignedImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanUnsigned - true", () => {
    const firstValue = 2;
    const secondValue = 1;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = getRegisters([firstValue, initialResultRegister, secondValue]);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanUnsigned(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanUnsigned - false", () => {
    const firstValue = 2;
    const secondValue = 3;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = getRegisters([firstValue, initialResultRegister, secondValue]);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanUnsigned(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanSigned - true", () => {
    const firstValue = -2;
    const secondValue = -3;
    const initialResultRegister = 3;
    const resultValue = 1;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(SECOND_REGISTER, secondValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanSigned(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });

  await t.test("setLessThanSigned - false", () => {
    const firstValue = -2;
    const secondValue = -1;
    const initialResultRegister = 3;
    const resultValue = 0;
    const regs = new Registers();
    regs.setI32(FIRST_REGISTER, firstValue);
    regs.setI32(SECOND_REGISTER, secondValue);
    regs.setI32(RESULT_REGISTER, initialResultRegister);
    const bitOps = new BooleanOps(regs);

    bitOps.setLessThanSigned(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU32(RESULT_REGISTER), resultValue);
  });
});
