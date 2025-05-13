import { type U64, tryAsU64 } from "@typeberry/numbers";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { OutOfBounds, type PageFault } from "@typeberry/pvm-interpreter/memory/errors";
import { MEMORY_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { OK, Result } from "@typeberry/utils";

export interface IHostCallMemory {
  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds>;
  loadInto(result: Uint8Array, startAddress: U64): Result<OK, PageFault | OutOfBounds>;
  getMemory(): Memory;
}

export class HostCallMemory implements IHostCallMemory {
  constructor(private readonly memory: Memory) {}

  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    if (address + tryAsU64(bytes.length) > MEMORY_SIZE) {
      return Result.error(new OutOfBounds());
    }

    return this.memory.storeFrom(tryAsMemoryIndex(Number(address)), bytes);
  }

  loadInto(result: Uint8Array, startAddress: U64): Result<OK, PageFault | OutOfBounds> {
    if (result.length === 0) {
      return Result.ok(OK);
    }

    if (startAddress + tryAsU64(result.length) > MEMORY_SIZE) {
      return Result.error(new OutOfBounds());
    }

    return this.memory.loadInto(result, tryAsMemoryIndex(Number(startAddress)));
  }

  isWriteable(address: U64, length: number): boolean {
    if (length === 0) {
      return true;
    }

    if (address + tryAsU64(length) > MEMORY_SIZE) {
      return false;
    }

    return this.memory.isWriteable(tryAsMemoryIndex(Number(address)), length);
  }

  getMemory(): Memory {
    return this.memory;
  }
}
