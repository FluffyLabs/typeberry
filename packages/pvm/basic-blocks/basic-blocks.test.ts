import assert from "node:assert";
import { describe, it } from "node:test";

import { Instruction } from "../instruction";
import { Mask } from "../program-decoder/mask";
import { BasicBlocks } from "./basic-blocks";

describe("BasicBlocks", () => {
  it("should return true for the first instruction even it is a termination block instruction", () => {
    const mask = new Mask(new Uint8Array([0b1111_1111]));
    const code = new Uint8Array([Instruction.TRAP]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = 0;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return true for the first instruction after a termination block instruction", () => {
    const mask = new Mask(new Uint8Array([0b1111_0011]));
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD, 5, 7]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = 1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return false for the second instruction after a termination block instruction", () => {
    const mask = new Mask(new Uint8Array([0b1001_0011]));
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD, 5, 7, Instruction.SUB, 5, 7]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = 4;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });

  it("should return false for a termination block instruction that is not the first instruction in the program", () => {
    const mask = new Mask(new Uint8Array([0b1111_0011]));
    const code = new Uint8Array([Instruction.TRAP, Instruction.ADD, 5, 7, Instruction.TRAP]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = 4;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });

  it("should return true for a termination block instruction that is the after a termination instruction", () => {
    const mask = new Mask(new Uint8Array([0b1111_1111]));
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = 1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, true);
  });

  it("should return false for a negative number", () => {
    const mask = new Mask(new Uint8Array([0b1111_1111]));
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP]);
    const basicBlocks = new BasicBlocks(code, mask);
    const index = -1;

    const result = basicBlocks.isBeginningOfBasicBlock(index);

    assert.strictEqual(result, false);
  });
});
