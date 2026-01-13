import type { ServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { safeAllocUint8Array } from "@typeberry/utils";
import { logger } from "../logger.js";
import { getServiceIdOrCurrent } from "../utils.js";
import { HostCallResult } from "./results.js";

/** Account data interface for lookup host calls. */
export interface AccountsLookup {
  /** Lookup a preimage. */
  lookup(serviceId: ServiceId | null, hash: Blake2bHash): BytesBlob | null;
}

const IN_OUT_REG = 7;

/**
 * Lookup a preimage.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/329902329902?v=0.6.7
 */
export class Lookup implements HostCallHandler {
  index = tryAsHostCallIndex(2);

  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly account: AccountsLookup,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // a
    const serviceId = getServiceIdOrCurrent(IN_OUT_REG, regs, this.currentServiceId);

    // h
    const hashAddress = regs.get(8);
    // o
    const destinationAddress = regs.get(9);

    const preImageHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(preImageHash.raw, hashAddress);
    if (memoryReadResult.isError) {
      logger.trace`[${this.currentServiceId}] LOOKUP(${serviceId}, ${preImageHash}) <- PANIC`;
      return PvmExecution.Panic;
    }

    // v
    const preImage = this.account.lookup(serviceId, preImageHash);

    logger.trace`[${this.currentServiceId}] LOOKUP(${serviceId}, ${preImageHash}) <- ${preImage?.toStringTruncated() ?? "<missing>"}...`;
    logger.insane`[${this.currentServiceId}] LOOKUP(${serviceId}, ${preImageHash}) <- ${preImage ?? "<missing>"}`;

    const preImageLength = preImage === null ? tryAsU64(0) : tryAsU64(preImage.raw.length);
    const preimageBlobOffset = regs.get(10);
    const lengthToWrite = regs.get(11);

    // f
    const offset = minU64(preimageBlobOffset, preImageLength);
    // l
    const length = minU64(lengthToWrite, tryAsU64(preImageLength - offset));

    // NOTE [MaSo] this is ok to cast to number, because we are bounded by the
    // valueLength in both cases and valueLength is WC (4,000,000,000) + metadata
    // which is less than 2^32
    const chunk =
      preImage === null ? safeAllocUint8Array(0) : preImage.raw.subarray(Number(offset), Number(offset + length));
    const memoryWriteResult = memory.storeFrom(destinationAddress, chunk);
    if (memoryWriteResult.isError) {
      return PvmExecution.Panic;
    }

    if (preImage === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    regs.set(IN_OUT_REG, preImageLength);
  }
}
