import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
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
  const regs = Registers.empty();
  const memory = Memory.new();
  const memoryOps = MemoryOps.new(regs, memory, instructionResult);
  const moveOps = MoveOps.new(regs);
  const bitOps = BitOps.new(regs);
  const bitRotationOps = BitRotationOps.new(regs);
  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(memoryOps);
    mockAllMethods(moveOps);
    mockAllMethods(bitOps);
    mockAllMethods(bitRotationOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
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
