import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { TwoImmediatesArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { StoreOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { TwoImmsDispatcher } from "./two-imms-dispatcher.js";

describe("TwoImmsDispatcher", () => {
  const regs = Registers.empty();
  const memory = Memory.new();
  const instructionResult = new InstructionResult();
  const storeOps = StoreOps.new(regs, memory, instructionResult);

  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(storeOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const argsMock = {
    firstImmediateDecoder: ImmediateDecoder.new(),
    secondImmediateDecoder: ImmediateDecoder.new(),
  } as TwoImmediatesArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.TWO_IMMEDIATES);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by TwoImmsDispatcher`, () => {
      const dispatcher = new TwoImmsDispatcher(storeOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_IMMEDIATES);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by TwoImmsDispatcher`, () => {
      const dispatcher = new TwoImmsDispatcher(storeOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
