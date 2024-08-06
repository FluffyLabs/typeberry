import assert from "node:assert";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { OneImmediateResult } from "../args-decoder/args-decoder";
import { ArgumentType } from "../args-decoder/argument-type";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map";
import { Instruction } from "../instruction";
import { InstructionResult } from "../instruction-result";
import { HostCallOps } from "../ops";
import { OneImmDispatcher } from "./one-imm-dispatcher";

describe("OneImmDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = new HostCallOps(instructionResult);
    const hostCallMock = mock.fn();

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      hostCallMock.mock.resetCalls();
    });

    before(() => {
      mock.method(hostCallOps, "hostCall", hostCallMock);
    });

    const argsMock = {
      immediateDecoder: new ImmediateDecoder(),
    } as OneImmediateResult;

    it("should call HostCallOps.hostCall", () => {
      const dispatcher = new OneImmDispatcher(hostCallOps);

      dispatcher.dispatch(Instruction.ECALLI, argsMock);

      assert.strictEqual(hostCallMock.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = new HostCallOps(instructionResult);
    const mockFn = mock.fn();

    function mockAllMethods(obj: object) {
      const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) as (keyof typeof obj)[];

      for (const method of methodNames) {
        mock.method(obj, method, mockFn);
      }
    }

    before(() => {
      mockAllMethods(hostCallOps);
    });

    after(() => {
      mock.restoreAll();
    });

    beforeEach(() => {
      mockFn.mock.resetCalls();
    });

    const argsMock = {
      immediateDecoder: new ImmediateDecoder(),
    } as OneImmediateResult;

    const otherInstructions = Object.entries(Instruction)
      .filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
      .filter((entry) => instructionArgumentTypeMap[entry[1]] !== ArgumentType.ONE_IMMEDIATE);

    for (const [name, instruction] of otherInstructions) {
      it(`checks if instruction ${name} = ${instruction} is not handled by OneImmDispatcher`, () => {
        const dispatcher = new OneImmDispatcher(hostCallOps);

        dispatcher.dispatch(instruction, argsMock);

        assert.strictEqual(mockFn.mock.calls.length, 0);
      });
    }
  });
});
