import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { TwoRegistersTwoImmediatesResult } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { DynamicJumpOps, LoadOps } from "../ops";
import { PageMap } from "../page-map";
import { JumpTable } from "../program-decoder/jump-table";
import { Mask } from "../program-decoder/mask";
import { Registers } from "../registers";
import { TwoRegsTwoImmsDispatcher } from "./two-regs-two-imms-dispatcher";

describe("TwoRegsTwoImmsDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const regs = new Registers();
    const memory = new Memory(new PageMap([]), []);
    const jumpTable = new JumpTable(1, new Uint8Array([1]));
    const instructionResult = new InstructionResult();
    const mask = new Mask(new Uint8Array([1]));
    const loadOps = new LoadOps(regs, memory, instructionResult);
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, mask);
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
    } as TwoRegistersTwoImmediatesResult;

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
    const memory = new Memory(new PageMap([]), []);
    const loadOps = new LoadOps(regs, memory, instructionResult);
    const jumpTable = new JumpTable(1, new Uint8Array([1]));
    const mask = new Mask(new Uint8Array([1]));
    const dynamicJumpOps = new DynamicJumpOps(regs, jumpTable, instructionResult, mask);
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
    } as TwoRegistersTwoImmediatesResult;

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
