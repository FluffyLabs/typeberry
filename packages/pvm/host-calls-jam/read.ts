import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import { createMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, getServiceId, writeServiceIdAsLeBytes } from "./utils";

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
const SERVICE_ID_BYTES = 4;

/**
 * Read account storage.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/2d3a002d3a00
 */
export class Read implements HostCallHandler {
  index = 2 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // k_0
    const keyStartAddress = createMemoryIndex(regs.asUnsigned[8]);
    // k_z
    const keyLen = regs.asUnsigned[9];
    // b_0
    const destinationStart = createMemoryIndex(regs.asUnsigned[10]);
    // b_z
    const destinationLen = regs.asUnsigned[11];

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const keyLoadingFault = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);

    // we return OOB in case the destination is not writeable or the key can't be loaded.
    if (keyLoadingFault || !destinationWriteable) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return Promise.resolve();
    }

    const keyHash = hashBytes(key);
    const value = await this.account.read(serviceId, keyHash);

    if (value === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return Promise.resolve();
    }

    // copy value to the memory and set the length to register 7
    memory.storeFrom(destinationStart, value.buffer.subarray(0, destinationLen));
    regs.asUnsigned[IN_OUT_REG] = value.buffer.length;
    return Promise.resolve();
  }
}
