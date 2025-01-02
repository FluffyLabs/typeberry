import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { BitOps } from "./bit-ops";

describe("BitOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = new Registers();
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    const bitOps = new BitOps(regs);

    return { regs, bitOps, immediate, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex };
  }

  it("or", () => {
    const firstValue = 0b01n;
    const secondValue = 0b10n;
    const resultValue = 0b11n;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.or(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("orImmediate", () => {
    const firstValue = 0b01n;
    const secondValue = 0b10n;
    const resultValue = 0b11n;
    const { bitOps, regs, immediate, firstRegisterIndex, resultRegisterIndex } = prepareData(firstValue, secondValue);

    bitOps.orImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("and", () => {
    const firstValue = 0b101n;
    const secondValue = 0b011n;
    const resultValue = 0b001n;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.and(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("andImmediate", () => {
    const firstValue = 0b101n;
    const secondValue = 0b011n;
    const resultValue = 0b001n;
    const { bitOps, regs, immediate, firstRegisterIndex, resultRegisterIndex } = prepareData(firstValue, secondValue);

    bitOps.andImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("xor", () => {
    const firstValue = 0b101n;
    const secondValue = 0b110n;
    const resultValue = 0b011n;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.xor(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("xorImmediate", () => {
    const firstValue = 0b101n;
    const secondValue = 0b110n;
    const resultValue = 0b011n;
    const { bitOps, regs, immediate, firstRegisterIndex, resultRegisterIndex } = prepareData(firstValue, secondValue);

    bitOps.xorImmediate(firstRegisterIndex, immediate, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });
});
