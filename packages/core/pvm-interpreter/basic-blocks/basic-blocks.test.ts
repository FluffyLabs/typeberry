import assert from "node:assert";
import { describe, it } from "node:test";

import { BitVec } from "@typeberry/bytes";
import { Instruction } from "../instruction";
import { Mask } from "../program-decoder/mask";
import { BasicBlocks } from "./basic-blocks";

describe("BasicBlocks", () => {
  it("should return true for the first instruction even it is a termination block instruction", () => {
    const code = new Uint8Array([Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 0;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return true for the first instruction after a termination block instruction", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD_32, 5, 7]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0011]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return false for the second instruction after a termination block instruction", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD_32, 5, 7, Instruction.SUB_32, 5, 7]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0001_0011]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 4;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });

  it("should return false for a termination block instruction that is not the first instruction in the program", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD_32, 5, 7, Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0001_0011]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 4;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });

  it("should return true for a beginning of basic block instruction that is not the first instruction after a block termination instruction that has some args", () => {
    const code = new Uint8Array([Instruction.BRANCH_EQ, 135, 25, Instruction.ADD_32, 5, 7, Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0100_1001]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 3;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return true for a termination block instruction that is the after a termination instruction", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0011]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = 1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return false for a negative number", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0011]), code.length));
    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);
    const index = -1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });

  it("should correctly detect basic blocks when distance between instructions is longer than 24", () => {
    const code = new Uint8Array([
      Instruction.TRAP,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      Instruction.JUMP_IND,
    ]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001, 0b0000_0000, 0b0000_0000, 0b1000_0000]), 32));

    const basicBlocks = new BasicBlocks();
    basicBlocks.reset(code, mask);

    const expectedStartingBasicBlockIndices = [0, 26];

    for (let i = 0; i < 32; i++) {
      assert.strictEqual(basicBlocks.isBeginningOfBasicBlock(i), expectedStartingBasicBlockIndices.includes(i));
    }
  });
});
