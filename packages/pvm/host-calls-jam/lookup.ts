import type { ServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, HASH_SIZE, hashBytes } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, getServiceId } from "./utils";

/** Account data interface for Lookup host call. */
export interface Accounts {
  /** Lookup a preimage. */
  lookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}

const IN_OUT_REG = 7;

/**
 * Lookup a preimage.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/2ca7012ca701
 */
export class Lookup implements HostCallHandler {
  index = tryAsHostCallIndex(1);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // h_0
    const keyStartAddress = tryAsMemoryIndex(regs.asUnsigned[8]);
    // b_0
    const destinationStart = tryAsMemoryIndex(regs.asUnsigned[9]);
    // b_z
    const destinationLen = regs.asUnsigned[10];

    const key = Bytes.zero(HASH_SIZE);
    const hashLoadingFault = memory.loadInto(key.raw, keyStartAddress);
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);
    // we return OOB in case the destination is not writeable or the key can't be loaded.
    if (hashLoadingFault || !destinationWriteable) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return Promise.resolve();
    }
    const keyHash = hashBytes(key);
    const value = await this.account.lookup(serviceId, keyHash);

    if (value === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return Promise.resolve();
    }

    // copy value to the memory and set the length to register 7
    memory.storeFrom(destinationStart, value.raw.subarray(0, destinationLen));
    regs.asUnsigned[IN_OUT_REG] = value.raw.length;
    return Promise.resolve();
  }
}
