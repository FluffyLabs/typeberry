import type { Result } from "./result";

export class InstructionResult {
  public nextPc = 0;
  public status: Result | null = null;
  public faultAddress: number | null = null;
}
