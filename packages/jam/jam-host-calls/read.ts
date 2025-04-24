import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { tryAsU64, tryBigIntAsNumber } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, legacyGetServiceId, writeServiceIdAsLeBytes } from "./utils";

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
 * https://graypaper.fluffylabs.dev/#/579bd12/304101304101
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(2);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = legacyGetServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // k_0
    const keyStartAddress = regs.get(8);
    // k_z
    const keyLen = tryBigIntAsNumber(regs.get(9));
    // b_0
    const destinationStart = regs.get(10);
    // b_z
    const destinationLen = tryBigIntAsNumber(regs.get(11));

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const keyLoadingResult = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);

    // we return OOB in case the destination is not writeable or the key can't be loaded.
    if (keyLoadingResult.isError || !destinationWriteable) {
      regs.set(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const keyHash = blake2b.hashBytes(key);
    const value = await this.account.read(serviceId, keyHash);

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // copy value to the memory and set the length to register 7
    memory.storeFrom(destinationStart, value.raw.subarray(0, destinationLen));
    regs.set(IN_OUT_REG, tryAsU64(value.raw.length));
  }
}
