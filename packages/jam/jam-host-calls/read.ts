import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  PvmExecution,
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
 * https://graypaper.fluffylabs.dev/#/68eaa1f/302701302701?v=0.6.4
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(2);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    if (serviceId === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // k_0
    const keyStartAddress = tryAsMemoryIndex(regs.getU32(8));
    // k_z
    const keyLen = tryAsMemoryIndex(regs.getU32(9));
    // o
    const destinationAddress = tryAsMemoryIndex(regs.getU32(10));

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    writeServiceIdAsLeBytes(this.currentServiceId, key);
    const pageFault = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    if (pageFault !== null) {
      return Promise.resolve(PvmExecution.Panic);
    }

    const keyHash = blake2b.hashBytes(key);

    // v
    const value = await this.account.read(serviceId, keyHash);
    if (value === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const valueLength = tryAsU64(value.raw.length);
    const valueBlobOffset = tryAsU64(regs.getU64(11));
    const lengthToWrite = tryAsU64(regs.getU64(12));

    // f
    const start = minU64(valueBlobOffset, valueLength);
    // l
    const blobLength = minU64(lengthToWrite, tryAsU64(valueLength - start));

    const writePageFault = memory.storeFrom(
      destinationAddress,
      value.raw.subarray(Number(start), Number(start + blobLength)),
    );
    if (writePageFault !== null) {
      return Promise.resolve(PvmExecution.Panic);
    }
    regs.setU64(IN_OUT_REG, valueLength);
  }
}
