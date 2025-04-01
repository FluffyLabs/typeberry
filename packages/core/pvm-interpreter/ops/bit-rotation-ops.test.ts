import assert from "node:assert";
import { describe, it } from "node:test";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { BitRotationOps } from "./bit-rotation-ops";

describe("BitRotationOps", () => {
  describe("reverseBytes", () => {
    function prepareData(firstValue: bigint) {
      const regs = Registers.new();
      const valueRegisterIndex = 0;
      const resultRegisterIndex = 12;

      regs.setU64(valueRegisterIndex, firstValue);

      const bitRotationOps = new BitRotationOps(regs);

      return { regs, bitRotationOps, valueRegisterIndex, resultRegisterIndex };
    }

    it("should reverse bytes in positive number", () => {
      const value = 0x12_34_56_78_9a_bc_de_f0n;
      const expectedValue = 0xf0_de_bc_9a_78_56_34_12n;
      const { bitRotationOps, regs, resultRegisterIndex, valueRegisterIndex } = prepareData(value);

      bitRotationOps.reverseBytes(valueRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
    });

    it("should reverse bytes in negative number", () => {
      const value = -0x12_34_56_78_9a_bc_de_f0n;
      const expectedValue = 0x10_21_43_65_87_a9_cb_edn;
      const { bitRotationOps, regs, resultRegisterIndex, valueRegisterIndex } = prepareData(value);

      bitRotationOps.reverseBytes(valueRegisterIndex, resultRegisterIndex);

      assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
    });
  });

  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = Registers.new();
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    const resultRegisterIndex = 12;

    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    const bitRotationOps = new BitRotationOps(regs);

    return { regs, bitRotationOps, immediate, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex };
  }

  describe("rot left", () => {
    describe("rotL64", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0x8_9a_bc_de_f0_12_34_56_7n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0x765432110edcba98n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 0n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 64n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 128n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotL32", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78n;
        const shift = 12n;
        const expectedValue = 0x4_56_78_12_3n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (positive number, max value and max shift)", () => {
        const value = 0x7f_ff_ff_fen;
        const shift = 31n;
        const expectedValue = 0x3f_ff_ff_ffn;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78n;
        const shift = 16n;
        const expectedValue = 0xffffffffa988edcbn;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 0n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 32n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 128n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotL32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });
  });

  describe("rot right", () => {
    describe("rotR64", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0xa_bc_de_f0_12_34_56_78_9n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0x5432110edcba9876n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 0n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 64n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 128n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR64(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotR32", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78n;
        const shift = 12n;
        const expectedValue = 0x67_81_23_45n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (positive number, max value and max shift)", () => {
        const value = 0x7f_ff_ff_fen;
        const shift = 31n;
        const expectedValue = 0xfffffffffffffffcn;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78n;
        const shift = 16n;
        const expectedValue = 0xffffffffa988edcbn;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 0n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 32n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 128n;
        const expectedValue = 0xff_ff_ff_ff_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, secondRegisterIndex, resultRegisterIndex } = prepareData(
          value,
          shift,
        );

        bitRotationOps.rotR32(firstRegisterIndex, secondRegisterIndex, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotR64Imm", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0xa_bc_de_f0_12_34_56_78_9n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR64Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78_9a_bc_de_f0n;
        const shift = 28n;
        const expectedValue = 0x5432110edcba9876n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR64Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 0n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR64Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 64n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR64Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78_9a_bc_de_f0n;
        const shift = 128n;
        const expectedValue = 0x12_34_56_78_9a_bc_de_f0n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR64Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotR64ImmAlt", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78n;
        const shift = 28n;
        const expectedValue = 0x2345678000000001n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR64ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78n;
        const shift = 28n;
        const expectedValue = 0xdcba988ffffffffen;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR64ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 0n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR64ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 64n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR64ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78n;
        const shift = 128n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR64ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotR32Imm", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78n;
        const shift = 12n;
        const expectedValue = 0x67_81_23_45n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (positive number, max value and max shift)", () => {
        const value = 0x7f_ff_ff_fen;
        const shift = 31n;
        const expectedValue = 0xfffffffffffffffcn;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78n;
        const shift = 16n;
        const expectedValue = 0xffffffffa988edcbn;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 0n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 32n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78n;
        const shift = 128n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(value, shift);

        bitRotationOps.rotR32Imm(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });

    describe("rotR32ImmAlt", () => {
      it("should correctly rotate bits (positive number)", () => {
        const value = 0x12_34_56_78n;
        const shift = 12n;
        const expectedValue = 0x67_81_23_45n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (positive number, max value and max shift)", () => {
        const value = 0x7f_ff_ff_fen;
        const shift = 31n;
        const expectedValue = 0xfffffffffffffffcn;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (negative number)", () => {
        const value = -0x12_34_56_78n;
        const shift = 16n;
        const expectedValue = 0xffffffffa988edcbn;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (no rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 0n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (full rotation)", () => {
        const value = 0x12_34_56_78n;
        const shift = 32n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });

      it("should correctly rotate bits (shift overflow)", () => {
        const value = 0x12_34_56_78n;
        const shift = 128n;
        const expectedValue = 0x12345678n;
        const { bitRotationOps, regs, firstRegisterIndex, immediate, resultRegisterIndex } = prepareData(shift, value);

        bitRotationOps.rotR32ImmAlt(firstRegisterIndex, immediate, resultRegisterIndex);

        assert.strictEqual(regs.getU64(resultRegisterIndex), expectedValue);
      });
    });
  });
});
