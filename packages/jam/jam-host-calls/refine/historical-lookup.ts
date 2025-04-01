import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type HostCallHandler, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { PvmExecution } from "@typeberry/pvm-host-calls/host-call-handler";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID, getServiceId } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Lookup a historical preimage.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/346800346800
 */
export class HistoricalLookup implements HostCallHandler {
  index = tryAsHostCallIndex(17);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // we return NONE in case the serviceId is not valid.
    if (serviceId === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // h
    const hashStart = tryAsMemoryIndex(regs.getU32(8));
    // o
    const destinationStart = tryAsMemoryIndex(regs.getU32(9));

    const hash = Bytes.zero(HASH_SIZE);
    const hashLoadingFault = memory.loadInto(hash.raw, hashStart);
    // we return Panic in case the key can't be loaded.
    if (hashLoadingFault !== null) {
      return PvmExecution.Panic;
    }

    const value = await this.refine.historicalLookup(serviceId, hash);
    // we return NONE in case the value is not found.
    if (value === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // f
    const offset = Math.min(regs.getU32(10), value.raw.length);
    // l
    const destinationLen = Math.min(regs.getU32(11), value.raw.length - offset);

    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);
    if (!destinationWriteable) {
      return PvmExecution.Panic;
    }

    // copy value to the memory and set the length to register 7
    regs.setU32(IN_OUT_REG, value.raw.length);
    memory.storeFrom(destinationStart, value.raw.subarray(offset, offset + destinationLen));
  }
}
