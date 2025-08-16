import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { minU64 } from "@typeberry/numbers";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { HostCallResult } from "./results.js";
import { SERVICE_ID_BYTES, clampU64ToU32, getServiceIdOrCurrent, writeServiceIdAsLeBytes } from "./utils.js";

/** Account data interface for read host calls. */
export interface AccountsRead {
  /** Read service storage. */
  read(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null;
}

const IN_OUT_REG = 7;

/**
 * Read account storage.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/333b00333b00?v=0.6.7
 *
 * TODO [MaSo] Update storage key extraction https://graypaper.fluffylabs.dev/#/7e6ff6a/33d50033d500?v=0.6.7
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(2, {
      [GpVersion.V0_6_7]: 3,
    }),
  );
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

    // allocate extra bytes for the serviceId
    const serviceIdStorageKey = new Uint8Array(SERVICE_ID_BYTES + storageKeyLengthClamped);
    // if the serviceId is null, we will leave 0 to the first 4 bytes
    if (serviceId !== null) {
      writeServiceIdAsLeBytes(serviceId, serviceIdStorageKey);
    }
    const memoryReadResult = memory.loadInto(serviceIdStorageKey.subarray(SERVICE_ID_BYTES), storageKeyStartAddress);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // k
    const storageKey = blake2b.hashBytes(serviceIdStorageKey);

    // v
    const value = this.account.read(serviceId, storageKey);

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
      return PvmExecution.Panic;
    }

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    regs.set(IN_OUT_REG, valueLength);
  }
}
