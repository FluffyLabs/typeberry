import assert from "node:assert";
import { describe, it } from "node:test";
import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { Result } from "../result";
import { HostCallOps } from "./host-call-ops";

describe("HostCallOps", () => {
  it("should set correct status", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = new HostCallOps(instructionResult);
    const value = 0x7f;
    const immediateDecoder = new ImmediateDecoder();
    immediateDecoder.setBytes(new Uint8Array([value]));

    hostCallOps.hostCall(immediateDecoder);

    assert.strictEqual(instructionResult.status, Result.HOST);
  });

  it("should set correct exitParam", () => {
    const instructionResult = new InstructionResult();
    const hostCallOps = new HostCallOps(instructionResult);
    const value = 0x7f;
    const immediateDecoder = new ImmediateDecoder();
    immediateDecoder.setBytes(new Uint8Array([value]));

    hostCallOps.hostCall(immediateDecoder);

    assert.strictEqual(instructionResult.exitParam, value);
  });
});
