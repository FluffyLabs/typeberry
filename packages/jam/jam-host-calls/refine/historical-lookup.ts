import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { PvmExecution } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import type { RefineExternalities } from "../externalities/refine-externalities";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID, getServiceId } from "../utils";

const IN_OUT_REG = 7;

/**
 * Lookup a historical preimage.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/346700346700?v=0.6.4
 */
export class HistoricalLookup implements HostCallHandler {
  index = tryAsHostCallIndex(17);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // a
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // we return NONE in case the serviceId is not valid.
    if (serviceId === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

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
    // we return NONE in case the value is not found.
    if (value === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const length = tryAsU64(value.raw.length);
    // f
    const offset = minU64(regs.get(10), length);
    // l
    const destinationLen = minU64(regs.get(11), tryAsU64(length - offset));

    // NOTE: casting to u32 (number) is safe here because the length of the value is always less than 2^32 (for sure).
    const data = value.raw.subarray(Number(offset), Number(offset + destinationLen));
    const segmentWriteResult = memory.storeFrom(destinationStart, data);
    if (segmentWriteResult.isError) {
      return PvmExecution.Panic;
    }

    // copy value to the memory and set the length to register 7
    regs.set(IN_OUT_REG, length);
  }
}
