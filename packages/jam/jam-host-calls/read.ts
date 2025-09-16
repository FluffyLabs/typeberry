import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { logger } from "./logger.js";
import { HostCallResult } from "./results.js";
import { clampU64ToU32, getServiceIdOrCurrent } from "./utils.js";

/** Account data interface for read host calls. */
export interface AccountsRead {
  /** Read service storage. */
  read(serviceId: ServiceId | null, rawKey: BytesBlob): BytesBlob | null;
}

const IN_OUT_REG = 7;

/**
 * Read account storage.
 *
 * https://graypaper.fluffylabs.dev/#/1c979cb/325301325301?v=0.7.1
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(3);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11, 12);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly account: AccountsRead,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceIdOrCurrent(IN_OUT_REG, regs, this.currentServiceId);

    // k_o
    const storageKeyStartAddress = regs.get(8);
    // k_z
    const storageKeyLength = regs.get(9);
    // o
    const destinationAddress = regs.get(10);

    const storageKeyLengthClamped = clampU64ToU32(storageKeyLength);
    // k
    const rawKey = BytesBlob.blobFrom(new Uint8Array(storageKeyLengthClamped));

    const memoryReadResult = memory.loadInto(rawKey.raw, storageKeyStartAddress);
    if (memoryReadResult.isError) {
      logger.trace(`READ(${serviceId}, ${rawKey}) <- PANIC`);
      return PvmExecution.Panic;
    }

    // v
    const value = this.account.read(serviceId, rawKey);

    const valueLength = value === null ? tryAsU64(0) : tryAsU64(value.raw.length);
    const valueBlobOffset = regs.get(11);
    const lengthToWrite = regs.get(12);

    // f
    const offset = minU64(valueBlobOffset, valueLength);
    // l
    const blobLength = minU64(lengthToWrite, tryAsU64(valueLength - offset));

    // NOTE [MaSo] this is ok to cast to number, because we are bounded by the
    // valueLength in both cases and valueLength is WC (4,000,000,000) + metadata
    // which is less than 2^32
    const chunk = value === null ? new Uint8Array(0) : value.raw.subarray(Number(offset), Number(offset + blobLength));
    const memoryWriteResult = memory.storeFrom(destinationAddress, chunk);
    if (memoryWriteResult.isError) {
      logger.trace(`READ(${serviceId}, ${rawKey}) <- PANIC`);
      return PvmExecution.Panic;
    }

    if (value === null) {
      logger.trace(`READ(${serviceId}, ${rawKey}) <- NONE`);
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    logger.trace(`READ(${serviceId}, ${rawKey}) <- ${BytesBlob.blobFrom(chunk).toStringTruncated()}`);
    regs.set(IN_OUT_REG, valueLength);
  }
}
