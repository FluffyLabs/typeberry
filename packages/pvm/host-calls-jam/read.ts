import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, getServiceId, writeServiceIdAsLeBytes } from "./utils";

/** Account data interface for Read host call. */
export interface Accounts {
  /**
   * Read service storage.
   *
   * If `serviceId === currentServiceId` we should read from snapshot state.
   */
  read(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}

const IN_OUT_REG = 7;

/**
 * Read account storage.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/2d3a002d3a00
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(2);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // k_0
    const keyStartAddress = tryAsMemoryIndex(regs.get(8));
    // k_z
    const keyLen = regs.get(9);
    // b_0
    const destinationStart = tryAsMemoryIndex(regs.get(10));
    // b_z
    const destinationLen = regs.get(11);

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const keyLoadingFault = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);

    // we return OOB in case the destination is not writeable or the key can't be loaded.
    if (keyLoadingFault || !destinationWriteable) {
      regs.set(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const keyHash = hashBytes(key);
    const value = await this.account.read(serviceId, keyHash);

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // copy value to the memory and set the length to register 7
    memory.storeFrom(destinationStart, value.raw.subarray(0, destinationLen));
    regs.set(IN_OUT_REG, value.raw.length);
    return;
  }
}
