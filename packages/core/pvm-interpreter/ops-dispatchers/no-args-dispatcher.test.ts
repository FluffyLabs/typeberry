import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { NoArgsOps } from "../ops/index.js";
import { NoArgsDispatcher } from "./no-args-dispatcher.js";

describe("NoArgsDispatcher", () => {
  const instructionResult = new InstructionResult();
  const noArgsOps = new NoArgsOps(instructionResult);

  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(noArgsOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.NO_ARGUMENTS);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by OneRegTwoImmsDispatcher`, () => {
      const dispatcher = new NoArgsDispatcher(noArgsOps);

      dispatcher.dispatch(instruction);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.NO_ARGUMENTS);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by OneRegTwoImmsDispatcher`, () => {
      const dispatcher = new NoArgsDispatcher(noArgsOps);

      dispatcher.dispatch(instruction);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
