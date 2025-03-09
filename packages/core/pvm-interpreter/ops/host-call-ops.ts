import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import { Result } from "../result";

export class HostCallOps {
  constructor(private instructionResult: InstructionResult) {}

  hostCall(immediateDecoder: ImmediateDecoder) {
    this.instructionResult.status = Result.HOST;
    this.instructionResult.exitParam = immediateDecoder.getUnsigned();
  }
}
