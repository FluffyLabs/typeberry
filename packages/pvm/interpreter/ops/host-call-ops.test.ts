import assert from "node:assert";
import { describe, it } from "node:test";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { Result } from "../result";
import { bigintToUint8ArrayLE } from "../test-utils";
import { HostCallOps } from "./host-call-ops";

describe("HostCallOps", () => {
  function prepareData(immediateValue: bigint) {
    const instructionResult = new InstructionResult();
    const hostCallOps = new HostCallOps(instructionResult);
    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(immediateValue));

    return { hostCallOps, instructionResult, immediate };
  }

  it("should set correct status", () => {
    const { hostCallOps, instructionResult, immediate } = prepareData(0n);

    hostCallOps.hostCall(immediate);

    assert.strictEqual(instructionResult.status, Result.HOST);
  });

  it("should set correct exitParam", () => {
    const value = 0x7f;
    const { hostCallOps, instructionResult, immediate } = prepareData(BigInt(value));

    hostCallOps.hostCall(immediate);

    assert.strictEqual(instructionResult.exitParam, value);
  });
});
