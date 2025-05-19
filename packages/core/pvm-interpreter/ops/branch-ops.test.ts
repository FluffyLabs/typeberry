import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { InstructionResult } from "../instruction-result.js";
import { Instruction } from "../instruction.js";
import { Mask } from "../program-decoder/mask.js";
import { Registers } from "../registers.js";
import { Result } from "../result.js";
import { bigintToUint8ArrayLE } from "../test-utils.js";
import { BranchOps } from "./branch-ops.js";

describe("BranchOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint, initialNextPc: number) {
    const regs = new Registers();
    const instructionResult = new InstructionResult();
    const code = new Uint8Array([Instruction.ADD_32, 5, 6, Instruction.SUB_32, 5, 6]);
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
    instructionResult.nextPc = initialNextPc;
    const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
    const firstRegisterIndex = 0;
    const secondRegisterIndex = 1;
    regs.setU64(firstRegisterIndex, firstValue);
    regs.setU64(secondRegisterIndex, secondValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    return { regs, instructionResult, branchOps, firstRegisterIndex, secondRegisterIndex, immediate };
  }

  describe("jump", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult } = prepareData(0n, 0n, 1);

      branchOps.jump(nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc because nextPc is not the beginning of basic block", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult } = prepareData(0n, 0n, 0);

      branchOps.jump(nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });
  });

  describe("branchEq", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;

      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 5n, 1);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 1);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 5n, 0);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 0);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchEqImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 5n, 1);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 1);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 5n, 0);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 0);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchNe", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 5n, 1);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 6n, 1);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 5n, 0);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 6n, 0);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchNeImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 1);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 1);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 0);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 0);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtUnsigned", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 1);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 6n, 1);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 0);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(6n, 6n, 0);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 1);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 1);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 0);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 0);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeUnsigned", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 5n, 1);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 1);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(7n, 6n, 0);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(5n, 6n, 0);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 5n, 1);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 1);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(7n, 6n, 0);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 6n, 0);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLeUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 5n, 1);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 1);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(5n, 5n, 0);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 0);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGtUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 1);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 1);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 5n, 0);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(6n, 6n, 0);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtSignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -5n, 0);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 1);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -5n, 0);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 0);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtSigned", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -5n, 1);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -6n, 1);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -5n, 0);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });
  });

  describe("branchLeSignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 1);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-5n, -6n, 1);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 0);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-5n, -6n, 0);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGtSignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-5n, -6n, 1);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 1);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-5n, -6n, 0);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 0);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeSignedImmediate", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -6n, 1);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -5n, 1);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -7n, 0);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, immediate } = prepareData(-6n, -5n, 0);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeSigned", () => {
    it("should update nextPc", () => {
      const nextPc = 0;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-5n, -5n, 1);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const nextPc = 0;
      const expectedNextPc = 1;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -5n, 1);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -7n, 0);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const nextPc = 3;
      const expectedNextPc = 0;
      const { branchOps, instructionResult, firstRegisterIndex, secondRegisterIndex } = prepareData(-6n, -5n, 0);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });
});
