import type { Result } from "./result";

export class InstructionResult {
  public nextPc = 0;
  public status: Result | null = null;
  /**
   * A numeric exit parameter of the PVM.
   *
   * In case of a `status === Result.FAULT` this will be the memory address
   * that triggered the fault.
   * In case of a `status === Result.HOST` this will be the host call index
   * that should be invoked.
   *
   * In any other circumstance the value should be `null`.
   */
  public exitParam: number | null = null;

  reset() {
    this.nextPc = 0;
    this.status = null;
    this.exitParam = null;
  }
}
