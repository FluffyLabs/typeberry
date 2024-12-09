import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { BasicBlocks } from "../basic-blocks";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Mask } from "../program-decoder/mask";
import { Registers } from "../registers";
import { Result } from "../result";
import { BranchOps } from "./branch-ops";

describe("BranchOps", () => {
  describe("jump", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;

      branchOps.jump(nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;

      branchOps.jump(nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });
  });

  describe("branchEq", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 5);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 5);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchEq(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchEqImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      regs.set(firstRegisterIndex, 5);
      const immediate = 6;

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchEqImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchNe", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 5);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 5);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchNe(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchNeImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchNeImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtUnsigned", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 6);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchLtUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeUnsigned", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 5);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 7);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, 5);
      regs.set(secondRegisterIndex, 6);

      branchOps.branchGeUnsigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 7);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 5);

      branchOps.branchGeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLeUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchLeUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGtUnsignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 5;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = 6;
      regs.set(firstRegisterIndex, 6);

      branchOps.branchGtUnsignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtSignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -5;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -5;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchLtSigned", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -5, true);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -6, true);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -5, true);

      branchOps.branchLtSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });
  });

  describe("branchLeSignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -5, true);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -5, true);

      branchOps.branchLeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGtSignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -5, true);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -5, true);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -6;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchGtSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeSignedImmediate", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -5;
      regs.set(firstRegisterIndex, -5, true);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const immediate = -5;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -7;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const immediate = -5;
      regs.set(firstRegisterIndex, -6, true);

      branchOps.branchGeSignedImmediate(firstRegisterIndex, immediate, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });

  describe("branchGeSigned", () => {
    it("should update nextPc", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -5, true);
      regs.set(secondRegisterIndex, -5, true);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should not update nextPc (condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const basicBlocks = new BasicBlocks();
      instructionResult.nextPc = 1;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 0;
      const expectedNextPc = 1;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -5, true);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });

    it("should update status to PANIC (nextPc is not the beginning of basic block)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -7, true);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, Result.PANIC);
    });

    it("should not update status to PANIC (nextPc is not the beginning of basic block but condition is not met)", () => {
      const regs = new Registers();
      const instructionResult = new InstructionResult();
      const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
      const basicBlocks = new BasicBlocks();
      basicBlocks.reset(code, new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length)));
      instructionResult.nextPc = 0;
      const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
      const nextPc = 3;
      const expectedNextPc = 0;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.set(firstRegisterIndex, -6, true);
      regs.set(secondRegisterIndex, -5, true);

      branchOps.branchGeSigned(firstRegisterIndex, secondRegisterIndex, nextPc);

      assert.strictEqual(instructionResult.nextPc, expectedNextPc);
      assert.strictEqual(instructionResult.status, null);
    });
  });
});
