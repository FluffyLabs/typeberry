import { blake2b } from "@typeberry/hash";
import { minU64 } from "@typeberry/numbers";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Accounts } from "./accounts";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, SERVICE_ID_BYTES, getServiceId, writeServiceIdAsLeBytes } from "./utils";

const MAX_U32 = 2 ** 32 - 1;
const MAX_U32_BIG_INT = BigInt(MAX_U32);
const IN_OUT_REG = 7;

/**
 * Read account storage.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/333b00333b00?v=0.6.6
 */
export class Read implements HostCallHandler {
  index = tryAsHostCallIndex(2);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // s*
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);

    // k_o
    const storageKeyStartAddress = regs.get(8);
    // k_z
    const storageKeyLength = regs.get(9);
    // o
    const destinationAddress = regs.get(10);

    const storageKeyLengthClamped = storageKeyLength > MAX_U32_BIG_INT ? MAX_U32 : Number(storageKeyLength);

    // allocate extra bytes for the serviceId
    const serviceIdStorageKey = new Uint8Array(SERVICE_ID_BYTES + storageKeyLengthClamped);
    writeServiceIdAsLeBytes(serviceId, serviceIdStorageKey);
    const memoryReadResult = memory.loadInto(serviceIdStorageKey.subarray(SERVICE_ID_BYTES), storageKeyStartAddress);
    if (memoryReadResult.isError) {
      return Promise.resolve(PvmExecution.Panic);
    }

    const keyHash = blake2b.hashBytes(serviceIdStorageKey);

    // v
    const value = await this.account.read(serviceId, keyHash);

    const valueLength = value === null ? tryAsU64(0) : tryAsU64(value.raw.length);
    const valueBlobOffset = regs.get(11);
    const lengthToWrite = regs.get(12);

    // f
    const offset = minU64(valueBlobOffset, valueLength);
    // l
    const blobLength = minU64(lengthToWrite, tryAsU64(valueLength - offset));

    // NOTE casting to `U32` is safe here, since we are bounded by `valueLength`.
    const isWriteable = memory.isWriteable(destinationAddress, Number(blobLength));
    if (!isWriteable) {
      return Promise.resolve(PvmExecution.Panic);
    }

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const chunk = value.raw.subarray(Number(offset), Number(offset + blobLength));
    // NOTE we ignore this result because we've already verified that the memory is writable.
    memory.storeFrom(destinationAddress, chunk);

    regs.set(IN_OUT_REG, valueLength);
  }
}
