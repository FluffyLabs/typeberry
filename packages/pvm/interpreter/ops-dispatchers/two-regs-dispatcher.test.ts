import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { TwoRegistersArgs } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { MemoryOps, MoveOps } from "../ops";
import { Registers } from "../registers";
import { TwoRegsDispatcher } from "./two-regs-dispatcher";

describe("TwoRegsDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const instructionResult = new InstructionResult();
    const regs = new Registers();
    const memory = new Memory();
    const memoryOps = new MemoryOps(regs, memory, instructionResult);
    const moveOps = new MoveOps(regs);
    const sbrkMock = mock.fn();
    const moveRegisterMock = mock.fn();

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      sbrkMock.mock.resetCalls();
      moveRegisterMock.mock.resetCalls();
    });

    before(() => {
      mock.method(memoryOps, "sbrk", sbrkMock);
      mock.method(moveOps, "moveRegister", moveRegisterMock);
    });

    const argsMock = {} as TwoRegistersArgs;

    it("should call MemoryOps.sbrk", () => {
      const dispatcher = new TwoRegsDispatcher(moveOps, memoryOps);

      dispatcher.dispatch(Instruction.SBRK, argsMock);

      assert.strictEqual(sbrkMock.mock.calls.length, 1);
    });

    it("should call MoveOps.moveRegister", () => {
      const dispatcher = new TwoRegsDispatcher(moveOps, memoryOps);

      dispatcher.dispatch(Instruction.MOVE_REG, argsMock);

      assert.strictEqual(moveRegisterMock.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const instructionResult = new InstructionResult();
    const regs = new Registers();
    const memory = new Memory();
    const memoryOps = new MemoryOps(regs, memory, instructionResult);
    const moveOps = new MoveOps(regs);
    const mockFn = mock.fn();

    function mockAllMethods(obj: object) {
      const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

      for (const method of methodNames) {
        mock.method(obj, method, mockFn);
      }
    }

    before(() => {
      mockAllMethods(memoryOps);
      mockAllMethods(moveOps);
    });

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      mockFn.mock.resetCalls();
    });

    const argsMock = {} as TwoRegistersArgs;

    const otherInstructions = Object.entries(Instruction)
      .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
      .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.TWO_REGISTERS);

    for (const [name, instruction] of otherInstructions) {
      it(`checks if instruction ${name} = ${instruction} is not handled by TwoRegsDispatcher`, () => {
        const dispatcher = new TwoRegsDispatcher(moveOps, memoryOps);

        dispatcher.dispatch(instruction, argsMock);

        assert.strictEqual(mockFn.mock.calls.length, 0);
      });
    }
  });
});
