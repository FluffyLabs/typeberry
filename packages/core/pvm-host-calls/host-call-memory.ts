import { tryAsU32, type U64 } from "@typeberry/numbers";
import { type IMemory, MEMORY_SIZE, type PageFault } from "@typeberry/pvm-interface";
import { OutOfBounds } from "@typeberry/pvm-interpreter/memory/errors.js";
import { OK, Result } from "@typeberry/utils";

export class HostCallMemory {
  constructor(private readonly memory: IMemory) {}

  /**
   * Save some bytes into memory under given address.
   *
   * NOTE: Given address is U64 (pure register value),
   * but we use only lower 32-bits.
   */
  storeFrom(regAddress: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    // NOTE: We always take lower 32 bits from register value.
    //
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/25ed0025ed00?v=0.7.2
    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));

    if (address + bytes.length > MEMORY_SIZE) {
      return Result.error(
        new OutOfBounds(),
        () => `Memory access out of bounds: address ${address} + length ${bytes.length} exceeds memory size`,
      );
    }

    return this.memory.store(address, bytes);
  }

  /**
   * Read some bytes from memory under given address.
   *
   * NOTE: Given address is U64 (pure register value),
   * but we use only lower 32-bits.
   */
  loadInto(output: Uint8Array, regAddress: U64): Result<OK, PageFault | OutOfBounds> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/25ed0025ed00?v=0.7.2
    //
    // NOTE we are taking the the lower U32 part of the register, hence it's safe.
    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));

    if (address + output.length > MEMORY_SIZE) {
      return Result.error(
        new OutOfBounds(),
        () => `Memory access out of bounds: address ${address} + length ${output.length} exceeds memory size`,
      );
    }

    return this.memory.read(address, output);
  }
}
