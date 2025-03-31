import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { BooleanOps } from "./boolean-ops";

describe("BooleanOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = Registers.empty();
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);
    regs.setU64(resultRegisterIndex, 0xdeadbeefn);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    const bitOps = new BooleanOps(regs);

    return { regs, bitOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex, immediate };
  }

  it("setLessThanUnsignedImmediate - true", () => {
    const firstValue = 1n;
    const secondValue = 2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setLessThanUnsignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanUnsignedImmediate - false", () => {
    const firstValue = 3n;
    const secondValue = 2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setLessThanUnsignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setGreaterThanUnsignedImmediate - true", () => {
    const firstValue = 3n;
    const secondValue = 2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setGreaterThanUnsignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setGreaterThanUnsignedImmediate - false", () => {
    const firstValue = 1n;
    const secondValue = 2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setGreaterThanUnsignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanSignedImmediate - true", () => {
    const firstValue = -3n;
    const secondValue = -2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setLessThanSignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanSignedImmediate - false", () => {
    const firstValue = -1n;
    const secondValue = -2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setLessThanSignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setGreaterThanSignedImmediate - true", () => {
    const firstValue = -1n;
    const secondValue = -2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setGreaterThanSignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setGreaterThanSignedImmediate - false", () => {
    const firstValue = -3n;
    const secondValue = -2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, immediate, resultRegisterIndex, regs } = prepareData(firstValue, secondValue);

    bitOps.setGreaterThanSignedImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanUnsigned - true", () => {
    const firstValue = 1n;
    const secondValue = 2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex, regs } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.setLessThanUnsigned(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanUnsigned - false", () => {
    const firstValue = 3n;
    const secondValue = 2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex, regs } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.setLessThanUnsigned(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanSigned - true", () => {
    const firstValue = -3n;
    const secondValue = -2n;
    const resultValue = 1n;
    const { bitOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex, regs } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.setLessThanSigned(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("setLessThanSigned - false", () => {
    const firstValue = -1n;
    const secondValue = -2n;
    const resultValue = 0n;
    const { bitOps, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex, regs } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.setLessThanSigned(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });
});
