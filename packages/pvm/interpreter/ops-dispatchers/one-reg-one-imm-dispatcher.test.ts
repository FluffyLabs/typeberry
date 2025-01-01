import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { OneRegisterOneImmediateArgs } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { BasicBlocks } from "../basic-blocks";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { DynamicJumpOps, LoadOps, StoreOps } from "../ops";
import { JumpTable } from "../program-decoder/jump-table";
import { Registers } from "../registers";
import { OneRegOneImmDispatcher } from "./one-reg-one-imm-dispatcher";

describe("OneRegOneImmDispatcher", () => {
  const regs = new Registers();
  const memory = new Memory();
  const jumpTable = new JumpTable(1, new Uint8Array([1]));
  const instructionResult = new InstructionResult();
  const storeOps = new StoreOps(regs, memory, instructionResult);
  const loadOps = new LoadOps(regs, memory, instructionResult);
  const basicBlocks = new BasicBlocks();
  const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
  const mockFn = mock.fn();

  function mockAllMethods(obj: object) {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

    for (const method of methodNames) {
      mock.method(obj, method, mockFn);
    }
  }

  before(() => {
    mockAllMethods(storeOps);
    mockAllMethods(loadOps);
    mockAllMethods(dynamicJumpOps);
  });

  after(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    mockFn.mock.resetCalls();
  });

  const argsMock = {
    immediateDecoder: new ImmediateDecoder(),
  } as OneRegisterOneImmediateArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.ONE_REGISTER_ONE_IMMEDIATE);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by TwoImmsDispatcher`, () => {
      const dispatcher = new OneRegOneImmDispatcher(loadOps, storeOps, dynamicJumpOps);

      dispatcher.dispatch(instruction, argsMock);

      const expectedResult = instruction === Instruction.JUMP_IND ? 2 : 1;
      assert.strictEqual(mockFn.mock.calls.length, expectedResult);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.ONE_REGISTER_ONE_IMMEDIATE);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by TwoImmsDispatcher`, () => {
      const dispatcher = new OneRegOneImmDispatcher(loadOps, storeOps, dynamicJumpOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
