import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { Compatibility, GpVersion } from "@typeberry/utils";
import type { RefineExternalities } from "../externalities/refine-externalities.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID, getServiceIdOrCurrent } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Lookup a historical preimage.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/343b00343b00?v=0.6.7
 */
export class HistoricalLookup implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(17, {
      [GpVersion.V0_6_7]: 6,
    }),
  );
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9);

  constructor(private readonly refine: RefineExternalities) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // a
    const serviceId = getServiceIdOrCurrent(IN_OUT_REG, regs, this.currentServiceId);
    // h
    const hashStart = regs.get(8);
    // o
    const destinationStart = regs.get(9);

    const hash = Bytes.zero(HASH_SIZE);
    const hashLoadingResult = memory.loadInto(hash.raw, hashStart);
    // we return Panic in case the key can't be loaded.
    if (hashLoadingResult.isError) {
      return PvmExecution.Panic;
    }

    const value = await this.refine.historicalLookup(serviceId, hash);
    const length = tryAsU64(value === null ? 0 : value.raw.length);
    // f
    const offset = minU64(regs.get(10), length);
    // l
    const destinationLength = minU64(regs.get(11), tryAsU64(length - offset));

    // NOTE: casting to u32 (number) is safe here because we are bounded by length which is less than 2^32.
    const data =
      value === null ? new Uint8Array() : value.raw.subarray(Number(offset), Number(offset + destinationLength));
    const segmentWriteResult = memory.storeFrom(destinationStart, data);
    if (segmentWriteResult.isError) {
      return PvmExecution.Panic;
    }

    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    // copy value to the memory and set the length to register 7
    regs.set(IN_OUT_REG, length);
  }
}
