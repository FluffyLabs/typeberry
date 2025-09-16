import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { TwoRegistersTwoImmediatesArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { DynamicJumpOps, LoadOps } from "../ops/index.js";
import { JumpTable } from "../program-decoder/jump-table.js";
import { Registers } from "../registers.js";
import { TwoRegsTwoImmsDispatcher } from "./two-regs-two-imms-dispatcher.js";

describe("TwoRegsTwoImmsDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const regs = new Registers();
    const memory = new Memory();
    const jumpTable = new JumpTable(1, new Uint8Array([1]));
    const instructionResult = new InstructionResult();
    const loadOps = new LoadOps(regs, memory, instructionResult);
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, basicBlocks);
    const loadImmediateMock = mock.fn();
    const jumpIndMock = mock.fn();

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      loadImmediateMock.mock.resetCalls();
      jumpIndMock.mock.resetCalls();
    });

    before(() => {
      mock.method(dynamicJumpOps, "jumpInd", jumpIndMock);
      mock.method(loadOps, "loadImmediate", loadImmediateMock);
    });

    const argsMock = {
      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
      firstImmediateDecoder: new ImmediateDecoder(),
      secondImmediateDecoder: new ImmediateDecoder(),
    } as TwoRegistersTwoImmediatesArgs;

    it("should call LoadOps.loadImmediate", () => {
      const dispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);

      dispatcher.dispatch(Instruction.LOAD_IMM_JUMP_IND, argsMock);

      assert.strictEqual(loadImmediateMock.mock.calls.length, 1);
    });

    it("should call DynamicJumpOps.jumpInd", () => {
      const dispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);

      dispatcher.dispatch(Instruction.LOAD_IMM_JUMP_IND, argsMock);

      assert.strictEqual(jumpIndMock.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const instructionResult = new InstructionResult();
    const regs = new Registers();
    const memory = new Memory();
    const loadOps = new LoadOps(regs, memory, instructionResult);
    const jumpTable = new JumpTable(1, new Uint8Array([1]));
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
      mockAllMethods(dynamicJumpOps);
      mockAllMethods(loadOps);
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
    } as TwoRegistersTwoImmediatesArgs;

    const otherInstructions = Object.entries(Instruction)
      .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
      .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES);

    for (const [name, instruction] of otherInstructions) {
      it(`checks if instruction ${name} = ${instruction} is not handled by TwoRegsOneImmDispatcher`, () => {
        const dispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);

        dispatcher.dispatch(instruction, argsMock);

        assert.strictEqual(mockFn.mock.calls.length, 0);
      });
    }
  });
});
