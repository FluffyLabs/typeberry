import type { ServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
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
import { CURRENT_SERVICE_ID, getServiceId } from "./utils";

/** Account data interface for Lookup host call. */
export interface Accounts {
  /** Lookup a preimage. */
  lookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}

const IN_OUT_REG = 7;

/**
 * Lookup a preimage.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/2fa7012fa701?v=0.6.3
 */
export class Lookup implements HostCallHandler {
  index = tryAsHostCallIndex(1);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);

    // h
    const hashAddress = tryAsMemoryIndex(regs.getU32(8));
    // o
    const destinationAddress = tryAsMemoryIndex(regs.getU32(9));

    const preImageHash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(preImageHash.raw, hashAddress);
    if (pageFault !== null) {
      return Promise.resolve(PvmExecution.Panic);
    }

    // v
    const preImage = serviceId !== null ? await this.account.lookup(serviceId, preImageHash) : null;

    const preImageLength = preImage === null ? tryAsU64(0) : tryAsU64(preImage.raw.length);
    const preimageBlobOffset = tryAsU64(regs.getU64(10));
    const lengthToWrite = tryAsU64(regs.getU64(11));

    // f
    const start = minU64(preimageBlobOffset, preImageLength);
    // l
    const blobLength = minU64(lengthToWrite, tryAsU64(preImageLength - start));

    const isWriteable = memory.isWriteable(destinationAddress, Number(blobLength));
    if (!isWriteable) {
      return Promise.resolve(PvmExecution.Panic);
    }

    if (preImage === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // casting to `Number` is safe here, since we are bounded by `preImageLength` in both cases, which is `U32`
    const chunk = preImage.raw.subarray(Number(start), Number(start + blobLength));
    memory.storeFrom(destinationAddress, chunk);
    regs.setU64(IN_OUT_REG, preImageLength);
  }
}
