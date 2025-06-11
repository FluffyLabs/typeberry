import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { HostCallResult } from "./results.js";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, clampU64ToU32, writeServiceIdAsLeBytes } from "./utils.js";

/** Account data interface for write host calls. */
export interface AccountsWrite {
  /**
   * Alter the account storage. Put `data` under given key hash.
   * `null` indicates the storage entry should be removed.
   */
  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void>;
  /**
   * Read the length of some value from account snapshot state.
   * Returns `null` if the storage entry was empty.
   */
  readSnapshotLength(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null>;
  /**
   * Returns true if the storage is already full.
   * - aka Not enough balance to pay for the storage.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/331002331402?v=0.6.6
   */
  isStorageFull(serviceId: ServiceId): Promise<boolean>;
}

const IN_OUT_REG = 7;

/**
 * Write account storage.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/334b01334b01?v=0.6.6
 */
export class Write implements HostCallHandler {
  index = tryAsHostCallIndex(3);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: AccountsWrite) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // k_0
    const storageKeyStartAddress = regs.get(7);
    // k_z
    const storageKeyLength = regs.get(8);
    // v_0
    const valueStart = regs.get(9);
    // v_z
    const valueLength = regs.get(10);

    const storageKeyLengthClamped = clampU64ToU32(storageKeyLength);

    // allocate extra bytes for the serviceId
    const serviceIdStorageKey = new Uint8Array(SERVICE_ID_BYTES + storageKeyLengthClamped);
    writeServiceIdAsLeBytes(this.currentServiceId, serviceIdStorageKey);
    const keyLoadingResult = memory.loadInto(serviceIdStorageKey.subarray(SERVICE_ID_BYTES), storageKeyStartAddress);
    if (keyLoadingResult.isError) {
      return PvmExecution.Panic;
    }

    // k
    const storageKey = blake2b.hashBytes(serviceIdStorageKey);

    const valueLengthClamped = clampU64ToU32(valueLength);
    const value = new Uint8Array(valueLengthClamped);
    const valueLoadingResult = memory.loadInto(value, valueStart);
    // Note [MaSo] this is ok to return bcs if valueLength is 0, then this panic won't happen
    if (valueLoadingResult.isError) {
      return PvmExecution.Panic;
    }

    // Check if the storage is full
    const isStorageFull = await this.account.isStorageFull(this.currentServiceId);
    if (isStorageFull) {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
      return;
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/33af0133b201?v=0.6.6 */
    const maybeValue = valueLength === 0n ? null : BytesBlob.blobFrom(value);

    // a
    await this.account.write(this.currentServiceId, storageKey, maybeValue);

    // l
    const previousLength = await this.account.readSnapshotLength(this.currentServiceId, storageKey);
    regs.set(IN_OUT_REG, previousLength === null ? HostCallResult.NONE : tryAsU64(previousLength));
  }
}
