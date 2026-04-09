import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
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
    const regs = Registers.empty();
    const memory = Memory.new();
    const jumpTable = JumpTable.fromRaw(1, new Uint8Array([1]));
    const instructionResult = new InstructionResult();
    const loadOps = LoadOps.new(regs, memory, instructionResult);
    const basicBlocks = new BasicBlocks();
    const dynamicJumpOps = DynamicJumpOps.new(regs, jumpTable, instructionResult, basicBlocks);
    const loadImmediateMock = mock();
    const jumpIndMock = mock();

    after(() => {
      mock.restore();
    });

    beforeEach(() => {
      loadImmediateMock.mockClear();
      jumpIndMock.mockClear();
    });

    before(() => {
      spyOn(dynamicJumpOps as unknown as Record<string, (...args: unknown[]) => unknown>, "jumpInd").mockImplementation(
        jumpIndMock,
      );
      spyOn(loadOps as unknown as Record<string, (...args: unknown[]) => unknown>, "loadImmediate").mockImplementation(
        loadImmediateMock,
      );
    });

    const argsMock = {
      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
      firstImmediateDecoder: ImmediateDecoder.new(),
      secondImmediateDecoder: ImmediateDecoder.new(),
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
    const regs = Registers.empty();
    const memory = Memory.new();
    const loadOps = LoadOps.new(regs, memory, instructionResult);
    const jumpTable = JumpTable.fromRaw(1, new Uint8Array([1]));
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
      mockAllMethods(dynamicJumpOps);
      mockAllMethods(loadOps);
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
