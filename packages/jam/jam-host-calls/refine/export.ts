import { SEGMENT_BYTES, type Segment } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU64, tryBigIntAsNumber } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Export a segment to be imported by some future `refine` invokation.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/346902346902?v=0.6.4
 */
export class Export implements HostCallHandler {
  index = tryAsHostCallIndex(19);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `p`: segment start address
    const segmentStart = regs.get(IN_OUT_REG);
    // `z`: segment bounded length
    const segmentLength = Math.min(tryBigIntAsNumber(regs.get(8)), SEGMENT_BYTES);
    // destination (padded with zeros).
    const segment: Segment = Bytes.zero(SEGMENT_BYTES);

    const segmentReadResult = memory.loadInto(segment.raw.subarray(0, segmentLength), segmentStart);
    if (segmentReadResult.isError) {
      return PvmExecution.Panic;
    }

    // attempt to export a segment and fail if it's above the maximum.
    const segmentExported = this.refine.exportSegment(segment);
    if (segmentExported.isOk) {
      regs.set(IN_OUT_REG, tryAsU64(segmentExported.ok));
    } else {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
    }
  }
}
