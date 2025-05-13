import { BytesBlob } from "@typeberry/bytes";
import { blake2b } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Accounts } from "./accounts";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";

const MAX_U32 = 2 ** 32 - 1;
const MAX_U32_BIG_INT = BigInt(MAX_U32);
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

  constructor(private readonly account: Accounts) {}

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

    const storageKeyLengthClamped = storageKeyLength > MAX_U32_BIG_INT ? MAX_U32 : Number(storageKeyLength);

    // allocate extra bytes for the serviceId
    const serviceIdStorageKey = new Uint8Array(SERVICE_ID_BYTES + storageKeyLengthClamped);
    writeServiceIdAsLeBytes(this.currentServiceId, serviceIdStorageKey);
    const keyLoadingResult = memory.loadInto(serviceIdStorageKey.subarray(SERVICE_ID_BYTES), storageKeyStartAddress);
    if (keyLoadingResult.isError) {
      return PvmExecution.Panic;
    }

    // k
    const storageKey = blake2b.hashBytes(serviceIdStorageKey);

    const valueLengthClamped = valueLength > MAX_U32_BIG_INT ? MAX_U32 : Number(valueLength);
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
