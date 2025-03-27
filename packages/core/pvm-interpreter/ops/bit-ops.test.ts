import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { BitOps } from "./bit-ops";

describe("BitOps", () => {
  function prepareData(firstValue: bigint, secondValue = 0n) {
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

  it("andInv", () => {
    const firstValue = 0b011n;
    const secondValue = 0b101n;
    const resultValue = 0b010n;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.andInv(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("orInv", () => {
    const firstValue = 0b10n;
    const secondValue = 0b01n;
    const resultValue = 0xff_ff_ff_ff_ff_ff_ff_fen;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.orInv(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  it("xnor", () => {
    const firstValue = 0b101n;
    const secondValue = 0b110n;
    const resultValue = 0xff_ff_ff_ff_ff_ff_ff_fcn;
    const { bitOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
      firstValue,
      secondValue,
    );

    bitOps.xnor(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

    assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
  });

  describe("countSetBits64", () => {
    it("should return no of 1s in bigint", () => {
      const value = 0b101n;
      const resultValue = 2n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of 1s in bigint (min value)", () => {
      const value = 0n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of 1s in bigint (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 64n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("countSetBits32", () => {
    it("should return no of 1s in number", () => {
      const value = 0b101n;
      const resultValue = 2n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of 1s in number (min value)", () => {
      const value = 0n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of 1s in number (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 32n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.countSetBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("leadingZeroBits64", () => {
    it("should return no of leading 0s in bigint", () => {
      const value = 0b101n;
      const resultValue = 61n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of leading 0s in bigint (min value)", () => {
      const value = 0n;
      const resultValue = 64n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of leading 0s in bigint (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("leadingZeroBits32", () => {
    it("should return no of leading 0s in number", () => {
      const value = 0b101n;
      const resultValue = 29n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of leading 0s in number (min value)", () => {
      const value = 0n;
      const resultValue = 32n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of leading 0s in number (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.leadingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("trailingZeroBits64", () => {
    it("should return no of trailing 0s in bigint", () => {
      const value = 0b1010n;
      const resultValue = 1n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of trailing 0s in bigint (min value)", () => {
      const value = 0n;
      const resultValue = 64n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of trailing 0s in bigint (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits64(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("leadingZeroBits32", () => {
    it("should return no of trailing 0s in number", () => {
      const value = 0b1010n;
      const resultValue = 1n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of trailing 0s in number (min value)", () => {
      const value = 0n;
      const resultValue = 32n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });

    it("should return no of trailing 0s in number (max value)", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 0n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.trailingZeroBits32(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("signExtend8", () => {
    it("should extend sign", () => {
      const value = 0x80n;
      const resultValue = -0x80n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend8(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
    });

    it("should not extend sign", () => {
      const value = 0x70n;
      const resultValue = 0x70n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend8(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
    });

    it("should extend sign but should not change the least significant 8 bits", () => {
      const value = 0x00006d6d6d6dd48dn;
      const resultValue = 0xffffffffffffff8dn;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend8(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("signExtend16", () => {
    it("should extend sign", () => {
      const value = 0x8000n;
      const resultValue = -0x8000n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend16(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
    });

    it("should not extend sign", () => {
      const value = 0x7000n;
      const resultValue = 0x7000n;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend16(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getI64(resultRegisterIndex), resultValue);
    });

    it("should extend sign but should not change the least significant 16 bits", () => {
      const value = 0x00006d6d6d6dd46dn;
      const resultValue = 0xffffffffffffd46dn;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.signExtend16(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });

  describe("zeroExtend16", () => {
    it("should override 6 bytes with zeros", () => {
      const value = 2n ** 64n - 1n;
      const resultValue = 0xffffn;
      const { bitOps, regs, firstRegisterIndex, resultRegisterIndex } = prepareData(value);

      bitOps.zeroExtend16(firstRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), resultValue);
    });
  });
});
