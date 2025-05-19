import assert from "node:assert";
import { test } from "node:test";
import type { OneOffsetArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { BranchOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { OneOffsetDispatcher } from "./one-offset-dispatcher.js";

test("OneOffsetDispatcher", async (t) => {
  const regs = new Registers();
  const instructionResult = new InstructionResult();
  const basicBlocks = new BasicBlocks();
  const branchOps = new BranchOps(regs, instructionResult, basicBlocks);

  const mockFn = t.mock.fn();

  function mockAllMethods(obj: object) {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

    for (const method of methodNames) {
      t.mock.method(obj, method, mockFn);
    }
  }

  t.before(() => {
    mockAllMethods(branchOps);
  });

  t.after(() => {
    t.mock.restoreAll();
  });

  t.beforeEach(() => {
    mockFn.mock.resetCalls();
  });

  const argsMock = {} as OneOffsetArgs;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.ONE_OFFSET);

  for (const [name, instruction] of relevantInstructions) {
    await t.test(`checks if instruction ${name} = ${instruction} is handled by OneOffsetDispatcher`, () => {
      const dispatcher = new OneOffsetDispatcher(branchOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.ONE_OFFSET);

  for (const [name, instruction] of otherInstructions) {
    await t.test(`checks if instruction ${name} = ${instruction} is not handled by OneOffsetDispatcher`, () => {
      const dispatcher = new OneOffsetDispatcher(branchOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
