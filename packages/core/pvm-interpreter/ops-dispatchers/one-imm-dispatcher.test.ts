import { mock, spyOn } from "bun:test";
import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { OneImmediateArgs } from "../args-decoder/args-decoder.js";
import { ArgumentType } from "../args-decoder/argument-type.js";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { instructionArgumentTypeMap } from "../args-decoder/instruction-argument-type-map.js";
import { Instruction } from "../instruction.js";
import { InstructionResult } from "../instruction-result.js";
import { HostCallOps } from "../ops/index.js";
import { OneImmDispatcher } from "./one-imm-dispatcher.js";

describe("OneImmDispatcher", () => {
  describe("check if it handles expected instructions", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = HostCallOps.new(instructionResult);
    const hostCallMock = mock();

    after(() => {
      mock.restore();
    });

    beforeEach(() => {
      hostCallMock.mockClear();
    });

    before(() => {
      spyOn(hostCallOps as unknown as Record<string, (...args: unknown[]) => unknown>, "hostCall").mockImplementation(
        hostCallMock,
      );
    });

    const argsMock = {
      immediateDecoder: ImmediateDecoder.new(),
    } as OneImmediateArgs;

    it("should call HostCallOps.hostCall", () => {
      const dispatcher = new OneImmDispatcher(hostCallOps);

      dispatcher.dispatch(Instruction.ECALLI, argsMock);

      assert.strictEqual(hostCallMock.mock.calls.length, 1);
    });
  });

  describe("check if it handles other instructions than expected", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = HostCallOps.new(instructionResult);
    const mockFn = mock();

    function mockAllMethods(obj: object) {
      const target = obj as Record<string, (...args: unknown[]) => unknown>;
      for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(obj))) {
        spyOn(target, method).mockImplementation(mockFn);
      }
    }

    before(() => {
      mockAllMethods(hostCallOps);
    });

    after(() => {
      mock.restore();
    });

    beforeEach(() => {
      mockFn.mockClear();
    });

    const argsMock = {
      immediateDecoder: ImmediateDecoder.new(),
    } as OneImmediateArgs;

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
