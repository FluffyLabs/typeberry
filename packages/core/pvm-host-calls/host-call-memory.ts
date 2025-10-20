import { tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import { type IMemory, MEMORY_SIZE, type PageFault } from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";

export interface IHostCallMemory {
  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault>;
  loadInto(output: Uint8Array, address: U64): Result<OK, PageFault>;
}

// TODO [MaSo] Delte in favor of IMemory + add util for HC to safly change U64 reg value to U32 Address
export class HostCallMemory implements IHostCallMemory {
  constructor(private readonly memory: IMemory) {}

  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    if (address + tryAsU64(bytes.length) > MEMORY_SIZE) {
      return Result.error(
        { address: tryAsU32(Number(address)) },
        () => `Memory access out of bounds: address ${address} + length ${bytes.length} exceeds memory size`,
      );
    }

    // NOTE It's ok to convert to number, bcs addres + bytes.lenght must be smaller than MAX U32
    const addr = tryAsU32(Number(address));

    const result = this.memory.storeFrom(addr, bytes);

    if (result.isOk) {
      return Result.ok(OK);
    }

    return Result.error({ address: addr }, result.details);
  }

  loadInto(output: Uint8Array, address: U64): Result<OK, PageFault> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    if (address + tryAsU64(output.length) > MEMORY_SIZE) {
      return Result.error(
        { address: tryAsU32(Number(address)) },
        () => `Memory access out of bounds: address ${address} + length ${output.length} exceeds memory size`,
      );
    }

    // NOTE It's ok to convert to number, bcs addres + bytes.lenght must be smaller than MAX U32
    const addr = tryAsU32(Number(address));

    const result = this.memory.loadInto(addr, output);

    if (result.isOk) {
      return Result.ok(OK);
    }

    return Result.error({ address: addr }, result.details);
  }
}
