import { tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import { type IMemory, MEMORY_SIZE, type PageFault } from "@typeberry/pvm-interface";
import { OutOfBounds } from "@typeberry/pvm-interpreter/memory/errors.js";
import { OK, Result } from "@typeberry/utils";

export interface IHostCallMemory {
  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds>;
  loadInto(output: Uint8Array, address: U64): Result<OK, PageFault | OutOfBounds>;
}

export class HostCallMemory implements IHostCallMemory {
  constructor(private readonly memory: IMemory) {}

  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    if (address + tryAsU64(bytes.length) > MEMORY_SIZE) {
      return Result.error(
        new OutOfBounds(),
        () => `Memory access out of bounds: address ${address} + length ${bytes.length} exceeds memory size`,
      );
    }

    // NOTE It's ok to convert to number, bcs we check earlier that address + bytes.length is smaller than MAX_U32
    return this.memory.store(tryAsU32(Number(address)), bytes);
  }

  loadInto(output: Uint8Array, address: U64): Result<OK, PageFault | OutOfBounds> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    if (address + tryAsU64(output.length) > MEMORY_SIZE) {
      return Result.error(
        new OutOfBounds(),
        () => `Memory access out of bounds: address ${address} + length ${output.length} exceeds memory size`,
      );
    }

    // NOTE It's ok to convert to number, bcs we check earlier that address + bytes.length is smaller than MAX_U32
    return this.memory.read(tryAsU32(Number(address)), output);
  }
}
