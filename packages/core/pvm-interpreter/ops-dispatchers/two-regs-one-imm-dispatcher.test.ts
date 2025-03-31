import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { TwoRegistersOneImmediateArgs } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { BitOps, BitRotationOps, BooleanOps, LoadOps, MathOps, MoveOps, ShiftOps, StoreOps } from "../ops";
import { Registers } from "../registers";
import { TwoRegsOneImmDispatcher } from "./two-regs-one-imm-dispatcher";

describe("TwoRegsOneImmDispatcher", () => {
  const instructionResult = new InstructionResult();
  const regs = Registers.empty();
  const memory = new Memory();
  const mathOps = new MathOps(regs);
  const shiftOps = new ShiftOps(regs);
  const bitOps = new BitOps(regs);
  const booleanOps = new BooleanOps(regs);
  const moveOps = new MoveOps(regs);
  const storeOps = new StoreOps(regs, memory, instructionResult);
  const loadOps = new LoadOps(regs, memory, instructionResult);
  const bitRotationOps = new BitRotationOps(regs);

  const mockFn = mock.fn();

  function mockAllMethods(obj: object) {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

    for (const method of methodNames) {
      mock.method(obj, method, mockFn);
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
    mock.restoreAll();
  });

  beforeEach(() => {
    mockFn.mock.resetCalls();
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
