import type { HASH_SIZE, ServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { hashBytes } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import { createMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "./results";

/** Account data interface for Read host call. */
export interface Accounts {
  // NOTE: a special case of `2**32 - 1` should be handled as "current service"
  read(serviceId: ServiceId, hash: Bytes<typeof HASH_SIZE>): Promise<BytesBlob | null>;
}

const IN_OUT_REG = 7;
const SERVICE_ID_BYTES = 4;

export class Read implements HostCallHandler {
  index = 2 as HostCallIndex;
  gasCost = 10 as SmallGas;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // a
    const serviceId = regs.asUnsigned[IN_OUT_REG] as ServiceId;
    const serviceIdBytes = regs.getBytesAsLittleEndian(IN_OUT_REG, SERVICE_ID_BYTES);
    // k_0
    const keyStartAddress = createMemoryIndex(regs.asUnsigned[8]);
    // k_z
    const keyLen = regs.asUnsigned[9];
    // b_0
    const destinationStart = createMemoryIndex(regs.asUnsigned[10]);
    // b_z
    const destinationLen = regs.asUnsigned[11];

    // allocate extra bytes for the serviceId
    const key = new Uint8Array(SERVICE_ID_BYTES + keyLen);
    key.set(serviceIdBytes);
    const keyLoadingFault = memory.loadInto(key.subarray(SERVICE_ID_BYTES), keyStartAddress);
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);

    // we return OOB in case the destination is not writeable or the key can't be loaded.
    if (keyLoadingFault || !destinationWriteable) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return Promise.resolve();
    }

    const keyHash = hashBytes(key);
    const value = await this.account.read(serviceId, keyHash);

    if (value === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return Promise.resolve();
    }

    // copy value to the memory and set the length to register 7
    memory.storeFrom(destinationStart, value.buffer.subarray(0, destinationLen));
    regs.asUnsigned[IN_OUT_REG] = value.buffer.length;
    return Promise.resolve();
  }
}
