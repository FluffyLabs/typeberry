import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { minU64 } from "@typeberry/numbers";
import { tryAsU64, tryBigIntAsNumber } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
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
 * https://graypaper.fluffylabs.dev/#/68eaa1f/302701302701?v=0.6.4
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(2);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);

    // k_o
    const keyStartAddress = regs.get(8);
    // k_z
    const keyLen = tryAsMemoryIndex(tryBigIntAsNumber(regs.get(9)));
    // o
    const destinationAddress = regs.get(10);

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const memoryReadResult = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    if (memoryReadResult.isError) {
      return Promise.resolve(PvmExecution.Panic);
    }

    const keyHash = blake2b.hashBytes(key);

    // v
    const value = serviceId !== null ? await this.account.read(serviceId, keyHash) : null;

    const valueLength = value === null ? tryAsU64(0) : tryAsU64(value.raw.length);
    const valueBlobOffset = regs.get(11);
    const lengthToWrite = regs.get(12);

    // f
    const offset = minU64(valueBlobOffset, valueLength);
    // l
    const blobLength = minU64(lengthToWrite, tryAsU64(valueLength - offset));

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const writeResult = memory.storeFrom(
      destinationAddress,
      // NOTE casting to `U32` is safe here, since we are bounded by `valueLength`.
      value.raw.subarray(Number(offset), Number(offset + blobLength)),
    );
    if (writeResult.isError) {
      return Promise.resolve(PvmExecution.Panic);
    }
    regs.set(IN_OUT_REG, valueLength);
  }
}
