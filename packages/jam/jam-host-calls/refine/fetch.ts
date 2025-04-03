import { minU64, tryAsU64 } from "@typeberry/numbers";
import { type HostCallHandler, PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;
const OFFSET_REG = 8;
const DESTINATION_LEN_REG = 9;
const SEGMENT_TYPE_REG = 10;
const SEGMENT_INDEX_REG = 11;
const WORK_ITEM_INDEX_REG = 12;

/**
 * Fetch a segment from the externalities.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/344c01344c01?v=0.6.4
 */
export class Fetch implements HostCallHandler {
  index = tryAsHostCallIndex(16);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `o`: destination start
    const destinationStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));

    const segment = await this.refine.fetchSegment(regs, SEGMENT_TYPE_REG, SEGMENT_INDEX_REG, WORK_ITEM_INDEX_REG);
    if (segment.isError || segment.ok === null) {
      regs.setU64(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const length = tryAsU64(segment.ok.length);
    // `f`: offset
    const offset = minU64(tryAsU64(regs.getU64(OFFSET_REG)), length);
    // `l`: destination length
    const destinationLen = minU64(tryAsU64(regs.getU64(DESTINATION_LEN_REG)), tryAsU64(length - offset));

    const data = segment.ok.raw.subarray(Number(offset), Number(offset + destinationLen));
    if (data.length === 0) {
      regs.setU64(IN_OUT_REG, length);
      return;
    }

    const storeFault = memory.storeFrom(destinationStart, data);
    if (storeFault !== null) {
      return PvmExecution.Panic;
    }

    regs.setU64(IN_OUT_REG, length);
  }
}
