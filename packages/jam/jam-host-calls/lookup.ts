import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Accounts } from "./accounts";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, getServiceId } from "./utils";

const IN_OUT_REG = 7;

/**
 * Lookup a preimage.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/329802329802?v=0.6.6
 */
export class Lookup implements HostCallHandler {
  index = tryAsHostCallIndex(1);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);

    // h
    const hashAddress = regs.get(8);
    // o
    const destinationAddress = regs.get(9);

    const preImageHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(preImageHash.raw, hashAddress);
    if (memoryReadResult.isError) {
      return Promise.resolve(PvmExecution.Panic);
    }

    // v
    const preImage = await this.account.lookup(serviceId, preImageHash);

    const preImageLength = preImage === null ? tryAsU64(0) : tryAsU64(preImage.raw.length);
    const preimageBlobOffset = regs.get(10);
    const lengthToWrite = regs.get(11);

    // f
    const offset = minU64(preimageBlobOffset, preImageLength);
    // l
    const length = minU64(lengthToWrite, tryAsU64(preImageLength - offset));

    // NOTE [MaSo] we are checking if the address is writeable to preserve the correct order of error returns
    // casting to `Number` is safe here, since we are bounded by `preImageLength`,
    // and `preImageLength` is around `WC` (4,000,000) + metadata which is less than `U32`
    const isWriteable = memory.isWriteable(destinationAddress, Number(length));
    if (!isWriteable) {
      return Promise.resolve(PvmExecution.Panic);
    }

    if (preImage === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const chunk = preImage.raw.subarray(Number(offset), Number(offset + length));
    // NOTE [MaSo] we ignore this result because we've already verified that the memory is writable.
    memory.storeFrom(destinationAddress, chunk);

    regs.set(IN_OUT_REG, preImageLength);
  }
}
