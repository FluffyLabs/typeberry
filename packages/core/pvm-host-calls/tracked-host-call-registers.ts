import type { U64 } from "@typeberry/numbers";
import { HostCallRegisters } from "./host-call-registers.js";
import type { RegisterWriteOperation } from "./io-trace-logger.js";

/**
 * A wrapper around HostCallRegisters that tracks all write operations
 * for JIP-6 IO trace logging.
 */
export class TrackedHostCallRegisters extends HostCallRegisters {
  private readonly writeOperations: RegisterWriteOperation[] = [];

  override set(registerIndex: number, value: U64): void {
    super.set(registerIndex, value);
    this.writeOperations.push({
      index: registerIndex,
      value,
    });
  }

  getWriteOperations(): RegisterWriteOperation[] {
    return this.writeOperations;
  }

  clearWriteOperations(): void {
    this.writeOperations.length = 0;
  }
}
