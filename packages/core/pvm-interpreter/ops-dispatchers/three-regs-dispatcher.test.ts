import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { ThreeRegistersArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { BitOps, BitRotationOps, BooleanOps, MathOps, MoveOps, ShiftOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { ThreeRegsDispatcher } from "./three-regs-dispatcher.js";

describe("ThreeRegsDispatcher", () => {
  const regs = Registers.empty();
  const mathOps = MathOps.new(regs);
  const bitOps = BitOps.new(regs);
  const shiftOps = ShiftOps.new(regs);
  const booleanOps = BooleanOps.new(regs);
  const moveOps = MoveOps.new(regs);
  const bitRotationOps = BitRotationOps.new(regs);

  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(bitOps);
    mockAllMethods(booleanOps);
    mockAllMethods(moveOps);
    mockAllMethods(mathOps);
    mockAllMethods(bitOps);
    mockAllMethods(shiftOps);
    mockAllMethods(bitRotationOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const threeRegsInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.THREE_REGISTERS);

  for (const [name, instruction] of threeRegsInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by ThreeRegsDispatcher`, () => {
      const threeRegsDispatcher = new ThreeRegsDispatcher(
        mathOps,
        shiftOps,
        bitOps,
        booleanOps,
        moveOps,
        bitRotationOps,
      );

      threeRegsDispatcher.dispatch(instruction, {} as ThreeRegistersArgs);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.THREE_REGISTERS);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by ThreeRegsDispatcher`, () => {
      const threeRegsDispatcher = new ThreeRegsDispatcher(
        mathOps,
        shiftOps,
        bitOps,
        booleanOps,
        moveOps,
        bitRotationOps,
      );

      threeRegsDispatcher.dispatch(instruction, {} as ThreeRegistersArgs);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
