import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import type { InstructionResult } from "../instruction-result.js";
import { Result } from "../result.js";

export class HostCallOps {
  constructor(private instructionResult: InstructionResult) {}

  hostCall(immediateDecoder: ImmediateDecoder) {
    this.instructionResult.status = Result.HOST;
    this.instructionResult.exitParam = immediateDecoder.getUnsigned();
  }
}
