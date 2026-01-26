import type { U32, U64 } from "@typeberry/numbers";
import type { RegisterIndex } from "@typeberry/pvm-interpreter";

/**
 * Interface for tracking PVM I/O operations during host call execution.
 *
 * Implementations record memory reads/writes and register modifications
 * for debugging, tracing, or replay purposes.
 */
export interface IoTracker {
  /** Record a register write operation. */
  setReg(idx: number, val: U64): void;
  /** Record a memory read operation. */
  memRead(address: U32, data: Uint8Array): void;
  /** Record a memory write operation. */
  memWrite(address: U32, data: Uint8Array): void;
  /** Clear all recorded operations. */
  clear(): void;
}

/** Create a no-op tracker that discards all operations. */
export function noopTracker() {
  return new NoopIoTracker();
}

/**
 * No-op implementation that discards all tracked operations.
 * Used when I/O tracing is disabled.
 */
class NoopIoTracker implements IoTracker {
  clear(): void {}
  setReg(_idx: RegisterIndex, _val: U64): void {}
  memRead(_address: U32, _data: Uint8Array): void {}
  memWrite(_address: U32, _data: Uint8Array): void {}
}
