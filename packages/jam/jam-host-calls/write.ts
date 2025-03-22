import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { LegacyHostCallResult } from "./results";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";

/** Account data interface for Write host call. */
export interface Accounts {
  /**
   * Alter the account storage. Put `data` under given key hash.
   *
   * `null` indicates the storage entry should be removed.
   *
   */
  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void>;

  /**
   * Returns true if the storage is already full.
   *
   * It means that the threshold balance `a_t` is greater than current account balance `a_b`.
   * TODO [ToDr] Can be computed from `AccountInfo` - might need to be merged later.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/303103303503
   */
  isStorageFull(serviceId: ServiceId): Promise<boolean>;

  /**
   * Read the length of some value from account snapshot state.
   *
   * Returns `null` if the storage entry was empty.
   */
  readSnapshotLen(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null>;
}

const IN_OUT_REG = 7;

/**
 * Write account storage.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/305502305502
 */
export class Write implements HostCallHandler {
  index = tryAsHostCallIndex(3);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // Storage is full (i.e. `a_t > a_b` - threshold balance is greater than current balance).
    // NOTE that we first need to know if the storage is full, since the result
    // does not depend on the success of reading the key or value:
    // https://graypaper.fluffylabs.dev/#/579bd12/303103303103
    const isStorageFull = await this.account.isStorageFull(this.currentServiceId);
    if (isStorageFull) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.FULL);
      return;
    }

    // k_0
    const keyStartAddress = tryAsMemoryIndex(regs.getU32(7));
    // k_z
    const keyLen = regs.getU32(8);
    // v_0
    const valueStart = tryAsMemoryIndex(regs.getU32(9));
    // v_z
    const valueLen = regs.getU32(10);

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const keyLoadingFault = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);

    const value = new Uint8Array(valueLen);
    const valueLoadingFault = memory.loadInto(value, valueStart);

    const keyHash = blake2b.hashBytes(key);
    const maybeValue = valueLen === 0 ? null : BytesBlob.blobFrom(value);

    // we return OOB in case the value cannot be read or the key can't be loaded.
    if (keyLoadingFault != null || valueLoadingFault != null) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    const prevLenPromise = this.account.readSnapshotLen(this.currentServiceId, keyHash);
    await this.account.write(this.currentServiceId, keyHash, maybeValue);

    // Successful write or removal. We store previous value length in omega_7
    const prevLen = await prevLenPromise;
    regs.setU32(IN_OUT_REG, prevLen === null ? LegacyHostCallResult.NONE : prevLen);
    return;
  }
}
