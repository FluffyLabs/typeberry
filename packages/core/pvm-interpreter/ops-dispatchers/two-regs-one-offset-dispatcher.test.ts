import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { TwoRegistersOneOffsetArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { BranchOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { TwoRegsOneOffsetDispatcher } from "./two-regs-one-offset-dispatcher.js";

describe("TwoRegsOneOffsetDispatcher", () => {
  const regs = Registers.empty();
  const instructionResult = new InstructionResult();
  const basicBlocks = new BasicBlocks();
  const branchOps = BranchOps.new(regs, instructionResult, basicBlocks);

  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(branchOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const argsMock = {} as TwoRegistersOneOffsetArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.TWO_REGISTERS_ONE_OFFSET);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by TwoRegsOneOffsetDispatcher`, () => {
      const dispatcher = new TwoRegsOneOffsetDispatcher(branchOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_REGISTERS_ONE_OFFSET);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by TwoRegsOneOffsetDispatcher`, () => {
      const dispatcher = new TwoRegsOneOffsetDispatcher(branchOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
