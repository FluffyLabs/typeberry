import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { OneRegisterOneImmediateArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { DynamicJumpOps, LoadOps, StoreOps } from "../ops/index.js";
import { JumpTable } from "../program-decoder/jump-table.js";
import { Registers } from "../registers.js";
import { OneRegOneImmDispatcher } from "./one-reg-one-imm-dispatcher.js";

describe("OneRegOneImmDispatcher", () => {
  const regs = Registers.empty();
  const memory = Memory.new();
  const jumpTable = JumpTable.fromRaw(1, new Uint8Array([1]));
  const instructionResult = new InstructionResult();
  const storeOps = StoreOps.new(regs, memory, instructionResult);
  const loadOps = LoadOps.new(regs, memory, instructionResult);
  const basicBlocks = new BasicBlocks();
  const dynamicJumpOps = DynamicJumpOps.new(regs, jumpTable, instructionResult, basicBlocks);
  const mockFn = mock();

  function mockAllMethods(obj: object) {
    const target = obj as Record<string, (...args: unknown[]) => unknown>;
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
      spyOn(target, method).mockImplementation(mockFn);
    }
  }

  before(() => {
    mockAllMethods(storeOps);
    mockAllMethods(loadOps);
    mockAllMethods(dynamicJumpOps);
  });

  after(() => {
    mock.restore();
  });

  beforeEach(() => {
    mockFn.mockClear();
  });

  const argsMock = {
    immediateDecoder: ImmediateDecoder.new(),
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
