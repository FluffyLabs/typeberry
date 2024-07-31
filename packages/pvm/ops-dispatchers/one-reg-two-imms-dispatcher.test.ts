import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { OneRegisterTwoImmediatesResult } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { Instruction } from "../instruction";
import { Memory } from "../memory";
import { StoreOps } from "../ops/store-ops";
import { PageMap } from "../page-map";
import { Registers } from "../registers";
import { OneRegTwoImmsDispatcher } from "./one-reg-two-imms-dispatcher";

describe("OneRegTwoImmsDispatcher", () => {
  const regs = new Registers();
  const memory = new Memory(new PageMap([]), []);
  const storeOps = new StoreOps(regs, memory);

  const mockFn = mock.fn();

  function mockAllMethods(obj: object) {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

    for (const method of methodNames) {
      mock.method(obj, method, mockFn);
    }
  }

  before(() => {
    mockAllMethods(storeOps);
  });

  after(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    mockFn.mock.resetCalls();
  });

  const argsMock = {
    firstImmediateDecoder: new ImmediateDecoder(),
    secondImmediateDecoder: new ImmediateDecoder(),
  } as OneRegisterTwoImmediatesResult;

  const relevantInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] === ArgumentType.ONE_REGISTER_TWO_IMMEDIATES);

  for (const [name, instruction] of relevantInstructions) {
    it(`checks if instruction ${name} = ${instruction} is handled by OneRegTwoImmsDispatcher`, () => {
      const dispatcher = new OneRegTwoImmsDispatcher(storeOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });
  }

  const otherInstructions = Object.entries(Instruction)
    .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.ONE_REGISTER_TWO_IMMEDIATES);

  for (const [name, instruction] of otherInstructions) {
    it(`checks if instruction ${name} = ${instruction} is not handled by OneRegTwoImmsDispatcher`, () => {
      const dispatcher = new OneRegTwoImmsDispatcher(storeOps);

      dispatcher.dispatch(instruction, argsMock);

      assert.strictEqual(mockFn.mock.calls.length, 0);
    });
  }
});
