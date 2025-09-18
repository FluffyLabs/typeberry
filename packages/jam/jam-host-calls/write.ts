import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import type { StorageKey } from "@typeberry/state";
import { asOpaqueType, type Result, resultToString } from "@typeberry/utils";
import { logger } from "./logger.js";
import { HostCallResult } from "./results.js";
import { clampU64ToU32 } from "./utils.js";

/** Account data interface for write host calls. */
export interface AccountsWrite {
  /**
   * Alter the account storage. Put `data` under given key hash.
   * `null` indicates the storage entry should be removed.
   *
   * Returns "full" error if there is not enough balance to pay for
   * the storage and previous value length otherwise.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/331002331402?v=0.6.6
   */
  write(rawKey: BytesBlob, data: BytesBlob | null): Result<number | null, "full">;
}

const IN_OUT_REG = 7;

/**
 * Write account storage.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/334901334901?v=0.6.7
 */
export class Write implements HostCallHandler {
  index = tryAsHostCallIndex(4);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly account: AccountsWrite,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // k_0
    const storageKeyStartAddress = regs.get(IN_OUT_REG);
    // k_z
    const storageKeyLength = regs.get(8);
    // v_0
    const valueStart = regs.get(9);
    // v_z
    const valueLength = regs.get(10);

    const storageKeyLengthClamped = clampU64ToU32(storageKeyLength);

    const rawStorageKey = new Uint8Array(storageKeyLengthClamped);
    const keyLoadingResult = memory.loadInto(rawStorageKey, storageKeyStartAddress);
    if (keyLoadingResult.isError) {
      logger.trace("WRITE() <- PANIC");
      return PvmExecution.Panic;
    }

    // k
    const storageKey: StorageKey = asOpaqueType(BytesBlob.blobFrom(rawStorageKey));

    const valueLengthClamped = clampU64ToU32(valueLength);
    const value = new Uint8Array(valueLengthClamped);
    const valueLoadingResult = memory.loadInto(value, valueStart);
    // Note [MaSo] this is ok to return bcs if valueLength is 0, then this panic won't happen
    if (valueLoadingResult.isError) {
      logger.trace(`WRITE(${storageKey})}) <- PANIC`);
      return PvmExecution.Panic;
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/33af0133b201?v=0.6.6 */
    const maybeValue = valueLength === 0n ? null : BytesBlob.blobFrom(value);

    // a
    const result = this.account.write(storageKey, maybeValue);
    logger.trace(`WRITE(${storageKey}, ${maybeValue?.toStringTruncated()}) <- ${resultToString(result)}`);

    if (result.isError) {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
      return;
    }

    // l
    regs.set(IN_OUT_REG, result.ok === null ? HostCallResult.NONE : tryAsU64(result.ok));
  }
}
