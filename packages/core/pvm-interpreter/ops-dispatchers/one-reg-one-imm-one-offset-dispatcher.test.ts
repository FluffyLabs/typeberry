import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { OneRegisterOneImmediateOneOffsetArgs } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { BasicBlocks } from "../basic-blocks";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { BranchOps, LoadOps } from "../ops";
import { Registers } from "../registers";
import { OneRegOneImmOneOffsetDispatcher } from "./one-reg-one-imm-one-offset-dispatcher";

describe("OneRegOneImmOneOffsetDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const regs = Registers.new();
    const memory = new Memory();
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
    const loadOps = new LoadOps(regs, memory, instructionResult);

    after(() => {
      mock.restoreAll();
    });

    const argsMock = {
      immediateDecoder: new ImmediateDecoder(),
    } as OneRegisterOneImmediateOneOffsetArgs;

    it("it should call BranchOps.jump and LoadOps.loadImmediate", () => {
      const jumpMockFunction = mock.fn();
      const loadImmMockFunction = mock.fn();
      mock.method(branchOps, "jump", jumpMockFunction);
      mock.method(loadOps, "loadImmediate", loadImmMockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.LOAD_IMM_JUMP, argsMock);

      assert.strictEqual(jumpMockFunction.mock.calls.length, 1);
      assert.strictEqual(loadImmMockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchEqImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchEqImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_EQ_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchNeImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchNeImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_NE_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLtUnsignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchLtUnsignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LT_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLeUnsignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchLeUnsignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LE_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGeUnsignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchGeUnsignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GE_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGtUnsignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchGtUnsignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GT_U_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLtSignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchLtSignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LT_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchLeSignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchLeSignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_LE_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGeSignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchGeSignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GE_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });

    it("it should call BranchOps.branchGtSignedImmediate", () => {
      const mockFunction = mock.fn();
      mock.method(branchOps, "branchGtSignedImmediate", mockFunction);
      const oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);

      oneRegOneImmOneOffsetDispatcher.dispatch(Instruction.BRANCH_GT_S_IMM, argsMock);

      assert.strictEqual(mockFunction.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const regs = Registers.new();
    const memory = new Memory();
    const instructionResult = new InstructionResult();
    const basicBlocks = new BasicBlocks();
    const branchOps = new BranchOps(regs, instructionResult, basicBlocks);
    const loadOps = new LoadOps(regs, memory, instructionResult);

    const mockFn = mock.fn();

    function mockAllMethods(obj: object) {
      const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

      for (const method of methodNames) {
        mock.method(obj, method, mockFn);
      }
    }

    before(() => {
      mockAllMethods(branchOps);
      mockAllMethods(loadOps);
    });

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      mockFn.mock.resetCalls();
    });

    const argsMock = {
      immediateDecoder: new ImmediateDecoder(),
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
