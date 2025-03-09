import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { MoveOps } from "./move-ops";

describe("MoveOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = new Registers();
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    const moveOps = new MoveOps(regs);

    return { regs, moveOps, immediate, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex };
  }

  it("moveRegister", () => {
    const firstValue = 5n;
    const resultValue = firstValue;
    const { moveOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(firstValue, 0n);

    moveOps.moveRegister(firstRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("moveRegister u64", () => {
    const firstValue = 0x7fff_ffff_ffff_ffffn;
    const resultValue = firstValue;
    const { moveOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(firstValue, 0n);

    assert.strictEqual(regs.getU64(resultRegisterIndex), 0n);

    moveOps.moveRegister(firstRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfZero (condition satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const { moveOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    moveOps.cmovIfZero(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfZero (condition not satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 0n;
    const { moveOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    moveOps.cmovIfZero(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfNotZero (condition satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 5n;
    const { moveOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    moveOps.cmovIfNotZero(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfNotZero (condition not satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = 0n;
    const { moveOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    moveOps.cmovIfNotZero(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfZeroImmediate (condition satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const { moveOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    moveOps.cmovIfZeroImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfZeroImmediate (condition not satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = 0n;
    const { moveOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    moveOps.cmovIfZeroImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfNotZeroImmediate (condition satisfied)", () => {
    const firstValue = 3n;
    const secondValue = 5n;
    const resultValue = secondValue;
    const { moveOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    moveOps.cmovIfNotZeroImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("cmovIfNotZeroImmediate (condition not satisfied)", () => {
    const firstValue = 0n;
    const secondValue = 5n;
    const resultValue = 0n;
    const { moveOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(firstValue, secondValue);

    moveOps.cmovIfNotZeroImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });
});
