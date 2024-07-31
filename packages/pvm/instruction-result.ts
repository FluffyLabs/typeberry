import type { Result } from "./result";

export class InstructionResult {
  public pcOffset = 0;
  public status: Result | null = null;
}
