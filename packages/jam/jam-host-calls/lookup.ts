import type { ServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
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
    const hashAddress = tryAsMemoryIndex(regs.getU64(8));
    // o
    const destinationAddress = tryAsMemoryIndex(regs.getU64(9));

    const isMemoryReadable = memory.isReadable(hashAddress, HASH_SIZE);

    if (!isMemoryReadable) {
      return Promise.resolve(PvmExecution.Panic);
    }

    const preImageHash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(preImageHash.raw, hashAddress);
    if (pageFault !== null) {
      return Promise.resolve(PvmExecution.Panic);
    }

    if (preImageHash.raw.byteLength === 0 || serviceId === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // v
    const preImage = await this.account.lookup(serviceId, preImageHash);
    if (!preImage) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const preImageLength = preImage.raw.length;
    const w10 = regs.getU64(10);
    const w11 = regs.getU64(11);

    const f = Number(w10 < preImageLength ? w10 : preImageLength);
    const tmp = preImageLength - f;
    const l = Number(w11 < tmp ? w11 : tmp);

    const isDestinationMemoryWritable = memory.isWriteable(destinationAddress, l);
    if (!isDestinationMemoryWritable) {
      return Promise.resolve(PvmExecution.Panic);
    }

    regs.setU64(IN_OUT_REG, BigInt(preImageLength));
    memory.storeFrom(destinationAddress, preImage.raw.subarray(f, l));

    return;
  }
}
