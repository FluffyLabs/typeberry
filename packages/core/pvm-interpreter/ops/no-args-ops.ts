import type { InstructionResult } from "../instruction-result.js";
import { Result } from "../result.js";

export class NoArgsOps {
  constructor(private instructionResult: InstructionResult) {}

  trap() {
    this.instructionResult.status = Result.PANIC;
  }

  fallthrough() {
    // noop
  }
}
