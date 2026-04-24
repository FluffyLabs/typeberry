import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { OneRegisterOneImmediateOneOffsetArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { BasicBlocks } from "../basic-blocks/index.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory } from "../memory/index.js";
import { BranchOps, LoadOps } from "../ops/index.js";
import { Registers } from "../registers.js";
import { OneRegOneImmOneOffsetDispatcher } from "./one-reg-one-imm-one-offset-dispatcher.js";

describe("OneRegOneImmOneOffsetDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const regs = Registers.empty();
    const memory = Memory.new();
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const branchOps = BranchOps.new(regs, instructionResult, basicBlocks);
    const loadOps = LoadOps.new(regs, memory, instructionResult);

    after(() => {
      mock.restore();
    });

    const argsMock = {
      immediateDecoder: ImmediateDecoder.new(),
    } as OneRegisterOneImmediateOneOffsetArgs;

    it("it should call BranchOps.jump and LoadOps.loadImmediate", () => {
      const jumpMockFunction = mock();
      const loadImmMockFunction = mock();
      spyOn(branchOps as unknown as Record<string, (...args: unknown[]) => unknown>, "jump").mockImplementation(
        jumpMockFunction,
      );
      spyOn(loadOps as unknown as Record<string, (...args: unknown[]) => unknown>, "loadImmediate").mockImplementation(
        loadImmMockFunction,
      );
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.LOAD_IMM_JUMP, argsMock);

      assert.strictEqual(jumpMockFunction.mock.calls.length, 1);
      assert.strictEqual(loadImmMockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchEqImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchEqImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_EQ_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchNeImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchNeImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_NE_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLtUnsignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchLtUnsignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LT_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLeUnsignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchLeUnsignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LE_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGeUnsignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchGeUnsignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GE_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGtUnsignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchGtUnsignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GT_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLtSignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchLtSignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LT_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLeSignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchLeSignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LE_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGeSignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchGeSignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GE_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGtSignedImmediate", () => {
      const mockFunction = mock();
      spyOn(
        branchOps as unknown as Record<string, (...args: unknown[]) => unknown>,
        "branchGtSignedImmediate",
      ).mockImplementation(mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GT_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const regs = Registers.empty();
    const memory = Memory.new();
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const branchOps = BranchOps.new(regs, instructionResult, basicBlocks);
    const loadOps = LoadOps.new(regs, memory, instructionResult);

    const mockFn = mock();

    function mockAllMethods(obj: object) {
      const target = obj as Record<string, (...args: unknown[]) => unknown>;
      for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
        spyOn(target, method).mockImplementation(mockFn);
      }
    }

    before(() => {
      mockAllMethods(branchOps);
      mockAllMethods(loadOps);
    });

    after(() => {
      mock.restore();
    });

    beforeEach(() => {
      mockFn.mockClear();
    });

    const argsMock = {
      immediateDecoder: ImmediateDecoder.new(),
    } as OneRegisterOneImmediateOneOffsetArgs;

    const otherInstructions = Object.entries(Instruction)
      .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
      .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET);

    for (const [name, instruction] of otherInstructions) {
      it(`checks if instruction ${name} = ${instruction} is not handled by OneRegisterOneImmediateOneOffsetDispatcher`, () => {
        const dispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

        dispatcher.dispatch(instruction, argsMock);

        assert.strictEqual(mockFn.mock.calls.length, 0);
      });
    }
  });
});
