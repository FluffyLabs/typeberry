import assert from "node:assert";
import { test } from "node:test";

import { Registers } from "../registers";
import { MoveOps } from "./move-ops";

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

test("MoveOps", async (t) => {
  await t.test("moveRegister", () => {
    const firstValue = 5n;
    const resultValue = firstValue;
    const regs = getRegisters([firstValue]);
    const moveOps = new MoveOps(regs);

    moveOps.moveRegister(FIRST_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfZero (condition satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const regs = getRegisters([firstValue, secondValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfZero(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfZero (condition not satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 0n;
    const regs = getRegisters([firstValue, secondValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfZero(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfNotZero (condition satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 5n;
    const regs = getRegisters([firstValue, secondValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfNotZero(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfNotZero (condition not satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = 0n;
    const regs = getRegisters([firstValue, secondValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfNotZero(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfZeroImmediate (condition satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const regs = getRegisters([firstValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfZeroImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfZeroImmediate (condition not satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 0n;
    const regs = getRegisters([firstValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfZeroImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfNotZeroImmediate (condition satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const regs = getRegisters([firstValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfNotZeroImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });

  await t.test("cmovIfNotZeroImmediate (condition not satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = 0n;
    const regs = getRegisters([firstValue]);
    const moveOps = new MoveOps(regs);

    moveOps.cmovIfNotZeroImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

    assert.strictEqual(regs.getU64(RESULT_REGISTER), resultValue);
  });
});
