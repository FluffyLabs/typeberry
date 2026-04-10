import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { TwoRegistersOneImmediateArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { BitOps, BitRotationOps, BooleanOps, LoadOps, MathOps, MoveOps, ShiftOps, StoreOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { TwoRegsOneImmDispatcher } from "./two-regs-one-imm-dispatcher.js";

describe("TwoRegsOneImmDispatcher", () => {
  const instructionResult = new InstructionResult();
  const regs = new Registers();
  const memory = new Memory();
  const mathOps = new MathOps(regs);
  const shiftOps = new ShiftOps(regs);
  const bitOps = new BitOps(regs);
  const booleanOps = new BooleanOps(regs);
  const moveOps = new MoveOps(regs);
  const storeOps = new StoreOps(regs, memory, instructionResult);
  const loadOps = new LoadOps(regs, memory, instructionResult);
  const bitRotationOps = new BitRotationOps(regs);

  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(mathOps);
    mockAllMethods(shiftOps);
    mockAllMethods(bitOps);
    mockAllMethods(booleanOps);
    mockAllMethods(moveOps);
    mockAllMethods(storeOps);
    mockAllMethods(loadOps);
    mockAllMethods(bitRotationOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const argsMock = {
    immediateDecoder: new ImmediateDecoder(),
  } as TwoRegistersOneImmediateArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by TwoRegsOneImmDispatcher`, () => {
      const dispatcher = new TwoRegsOneImmDispatcher(
        mathOps,
        shiftOps,
        bitOps,
        booleanOps,
        moveOps,
        storeOps,
        loadOps,
        bitRotationOps,
      );

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by TwoRegsOneImmDispatcher`, () => {
      const dispatcher = new TwoRegsOneImmDispatcher(
        mathOps,
        shiftOps,
        bitOps,
        booleanOps,
        moveOps,
        storeOps,
        loadOps,
        bitRotationOps,
      );

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
