import type { InstructionResult } from "../instruction-result";
import { Result } from "../result";

export class NoArgsOps {
  constructor(private instructionResult: InstructionResult) {}

  trap() {
    this.instructionResult.status = Result.PANIC;
  }

  fallthrough() {
    // noop
  }
}
