import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { BasicBlocks } from "../basic-blocks";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { JumpTable } from "../program-decoder/jump-table";
import { Mask } from "../program-decoder/mask";
import { Registers } from "../registers";
import { Result } from "../result";
import { DynamicJumpOps } from "./dynamic-jump-ops";
import { MAX_VALUE } from "./math-consts";

describe("DynamicJumpOps", () => {
  it("should set correct nextPc", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP, Instruction.TRAP, Instruction.ADD, 5, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1111]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 3);

    dynamicJumpOps.jumpInd(1, registerIndex);

    assert.strictEqual(instructionResult.nextPc, 3);
    assert.strictEqual(instructionResult.status, null);
  });

  it("should set correct nextPc (address overflow)", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP, Instruction.TRAP, Instruction.ADD, 5, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1111]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, MAX_VALUE);

    dynamicJumpOps.jumpInd(5, registerIndex);

    assert.strictEqual(instructionResult.nextPc, 3);
    assert.strictEqual(instructionResult.status, null);
  });

  it("should change status to HALT", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 0xff_ff_00_00);

    dynamicJumpOps.jumpInd(0, registerIndex);

    assert.strictEqual(instructionResult.status, Result.HALT);
  });

  it("should change status to PANIC because dynamic address is equal to 0 ", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 0);

    dynamicJumpOps.jumpInd(0, registerIndex);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because dynamic address does not exist in jump table", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 11);

    dynamicJumpOps.jumpInd(5, registerIndex);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because dynamic address is not a multiple of jump aligment factor (that is equal to 4) ", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 4);

    dynamicJumpOps.jumpInd(5, registerIndex);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because destination is not an instrction", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 3);

    dynamicJumpOps.jumpInd(5, registerIndex);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because destination is not an instruction that is the beginning of basic block", () => {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const code = new Uint8Array([Instruction.ADD, 5, 6, Instruction.SUB, 5, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU32(registerIndex, 3);

    dynamicJumpOps.jumpInd(5, registerIndex);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });
});
