import { tryAsU32, type U64 } from "@typeberry/numbers";
import type { IMemory, PageFault } from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";
import type { IoTracker } from "./ecalli-io-tracker.js";

export class HostCallMemory {
  // Track successful memory reads and writes.
  public ioTracker: IoTracker | null = null;

  constructor(private readonly memory: IMemory) {}

  /**
   * Save some bytes into memory under given address.
   *
   * NOTE: Given address is U64 (pure register value),
   * but we use only lower 32-bits.
   */
  storeFrom(regAddress: U64, bytes: Uint8Array): Result<OK, PageFault> {
    if (bytes.length === 0) {
      return Result.ok(OK);
    }

    // NOTE: We always take lower 32 bits from register value.
    //
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/25ed0025ed00?v=0.7.2
    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));
    const result = this.memory.store(address, bytes);
    if (result.isOk && this.ioTracker !== null) {
      this.ioTracker.memWrite(address, bytes);
    }
    return result;
  }

  /**
   * Read some bytes from memory under given address.
   *
   * NOTE: Given address is U64 (pure register value),
   * but we use only lower 32-bits.
   */
  loadInto(output: Uint8Array, regAddress: U64): Result<OK, PageFault> {
    if (output.length === 0) {
      return Result.ok(OK);
    }

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/25ed0025ed00?v=0.7.2
    //
    // NOTE we are taking the the lower U32 part of the register, hence it's safe.
    const address = tryAsU32(Number(regAddress & 0xffff_ffffn));
    const result = this.memory.read(address, output);
    if (result.isOk && this.ioTracker !== null) {
      this.ioTracker.memRead(address, output);
    }
    return result;
  }
}
