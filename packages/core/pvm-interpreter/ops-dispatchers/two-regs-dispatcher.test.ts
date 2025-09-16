import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { TwoRegistersArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { BitOps, BitRotationOps, MemoryOps, MoveOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { TwoRegsDispatcher } from "./two-regs-dispatcher.js";

describe("TwoRegsDispatcher", () => {
  const instructionResult = new InstructionResult();
  const regs = new Registers();
  const memory = new Memory();
  const memoryOps = new MemoryOps(regs, memory, instructionResult);
  const moveOps = new MoveOps(regs);
  const bitOps = new BitOps(regs);
  const bitRotationOps = new BitRotationOps(regs);
  const mockFn = mock.fn();

  function mockAllMethods(obj: object) {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

    for (const method of methodNames) {
      mock.method(obj, method, mockFn);
    }
  }

  before(() => {
    mockAllMethods(memoryOps);
    mockAllMethods(moveOps);
    mockAllMethods(bitOps);
    mockAllMethods(bitRotationOps);
  });

  after(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    mockFn.mock.resetCalls();
  });

  const argsMock = {} as TwoRegistersArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.TWO_REGISTERS);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by OneRegTwoImmsDispatcher`, () => {
      const dispatcher = new TwoRegsDispatcher(moveOps, memoryOps, bitOps, bitRotationOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_REGISTERS);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by TwoRegsDispatcher`, () => {
      const dispatcher = new TwoRegsDispatcher(moveOps, memoryOps, bitOps, bitRotationOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
