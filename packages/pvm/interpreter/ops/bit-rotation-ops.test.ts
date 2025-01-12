import assert from "node:assert";
import { describe, it } from "node:test";
import { Registers } from "../registers";
import { BitRotationOps } from "./bit-rotation-ops";

describe("BitRotationOps", () => {
  describe("reverseBytes", () => {
    function prepareData(firstValue: bigint) {
      const regs = new Registers();
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
});
