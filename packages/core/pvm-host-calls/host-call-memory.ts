import type { U32 } from "@typeberry/numbers";
import { type IMemory, MEMORY_SIZE, type PageFault } from "@typeberry/pvm-interface";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { OK, Result } from "@typeberry/utils";

export class HostCallMemory implements IMemory {
  constructor(private readonly memory: Memory) {}

  storeFrom(address: U32, bytes: Uint8Array): Result<OK, PageFault> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    if (address + bytes.length > MEMORY_SIZE) {
      return Result.error(
        { address },
        () => `Memory access out of bounds: address ${address} + length ${bytes.length} exceeds memory size`,
      );
    }

    const result = this.memory.storeFrom(tryAsMemoryIndex(address), bytes);

    if (result.isOk) {
      return Result.ok(OK);
    }

    return Result.error({ address }, result.details);
  }

  loadInto(address: U32, output: Uint8Array): Result<OK, PageFault> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    if (address + output.length > MEMORY_SIZE) {
      return Result.error(
        { address },
        () => `Memory access out of bounds: address ${address} + length ${output.length} exceeds memory size`,
      );
    }

    const result = this.memory.loadInto(output, tryAsMemoryIndex(address));

    if (result.isOk) {
      return Result.ok(OK);
    }

    return Result.error({ address }, result.details);
  }
}
