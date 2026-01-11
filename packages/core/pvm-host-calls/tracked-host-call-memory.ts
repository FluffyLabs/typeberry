import { tryAsU32, type U64 } from "@typeberry/numbers";
import type { PageFault } from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";
import { HostCallMemory } from "./host-call-memory.js";
import type { MemoryOperation } from "./io-trace-logger.js";

/**
 * A wrapper around HostCallMemory that tracks all read/write operations
 * for JIP-6 IO trace logging.
 */
export class TrackedHostCallMemory extends HostCallMemory {
  private readonly operations: MemoryOperation[] = [];

  override storeFrom(regAddress: U64, bytes: Uint8Array): Result<OK, PageFault> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));
    const result = super.storeFrom(regAddress, bytes);

    if (result.isOk) {
      this.operations.push({
        type: "write",
        address,
        data: bytes.slice(),
      });
    }

    return result;
  }

  override loadInto(output: Uint8Array, regAddress: U64): Result<OK, PageFault> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));
    const result = super.loadInto(output, regAddress);

    if (result.isOk) {
      this.operations.push({
        type: "read",
        address,
        data: output.slice(),
      });
    }

    return result;
  }

  getOperations(): MemoryOperation[] {
    return this.operations;
  }

  clearOperations(): void {
    this.operations.length = 0;
  }
}
