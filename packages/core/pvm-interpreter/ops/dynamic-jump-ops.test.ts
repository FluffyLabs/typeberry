import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { JumpTable } from "../program-decoder/jump-table.js";
import { Mask } from "../program-decoder/mask.js";
import { Registers } from "../registers.js";
import { Result } from "../result.js";
import { bigintToUint8ArrayLE } from "../test-utils.js";
import { DynamicJumpOps } from "./dynamic-jump-ops.js";

describe("DynamicJumpOps", () => {
  function prepareData(firstValue: bigint, secondValue: bigint) {
    const regs = new Registers();
    const jumpTable = new JumpTable(1, new Uint8Array([0, 3]));
    const instructionResult = new InstructionResult();
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP, Instruction.TRAP, Instruction.ADD_32, 5, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1111]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const registerIndex = 0;
    regs.setU64(registerIndex, firstValue);
    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(secondValue));

    return {
      dynamicJumpOps,
      instructionResult,
      registerIndex,
      immediate,
    };
  }

  it("should set correct nextPc", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(3n, 1n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.nextPc, 3);
    assert.strictEqual(instructionResult.status, null);
  });

  it("should set correct nextPc (address overflow)", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(2n ** 32n - 1n, 5n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.nextPc, 3);
    assert.strictEqual(instructionResult.status, null);
  });

  it("should change status to HALT", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(0xff_ff_00_00n, 0n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.HALT);
  });

  it("should change status to PANIC because dynamic address is equal to 0 ", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(0n, 0n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because dynamic address does not exist in jump table", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(11n, 5n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because dynamic address is not a multiple of jump aligment factor (that is equal to 4) ", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(4n, 5n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because destination is not an instrction", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(3n, 5n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });

  it("should change status to PANIC because destination is not an instruction that is the beginning of basic block", () => {
    const { dynamicJumpOps, instructionResult, registerIndex, immediate } = prepareData(3n, 5n);

    const address = dynamicJumpOps.caluclateJumpAddress(immediate, registerIndex);
    dynamicJumpOps.jumpInd(address);

    assert.strictEqual(instructionResult.status, Result.PANIC);
  });
});
