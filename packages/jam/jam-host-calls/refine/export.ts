import { SEGMENT_BYTES, type Segment } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { minU64, tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { resultToString } from "@typeberry/utils";
import type { RefineExternalities } from "../externalities/refine-externalities.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Export a segment to be imported by some future `refine` invokation.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/341d01341d01?v=0.6.7
 */
export class Export implements HostCallHandler {
  index = tryAsHostCallIndex(7);
  basicGasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `p`: segment start address
    const segmentStart = regs.get(IN_OUT_REG);
    // `z`: segment bounded length
    // NOTE [MaSo] it's always safe to cast to u32 (number) because the length is bounded by SEGMENT_BYTES.
    const segmentLength = Number(minU64(regs.get(8), tryAsU64(SEGMENT_BYTES)));

    // `x`: destination (padded with zeros).
    const segment: Segment = Bytes.zero(SEGMENT_BYTES);
    const segmentReadResult = memory.loadInto(segment.raw.subarray(0, segmentLength), segmentStart);
    if (segmentReadResult.isError) {
      logger.trace`EXPORT(${segment.toStringTruncated()}) <- PANIC`;
      return PvmExecution.Panic;
    }

    // attempt to export a segment and fail if it's above the maximum.
    const segmentExported = this.refine.exportSegment(segment);
    logger.trace`EXPORT(${segment.toStringTruncated()}) <- ${resultToString(segmentExported)}`;

    if (segmentExported.isOk) {
      regs.set(IN_OUT_REG, tryAsU64(segmentExported.ok));
    } else {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
    }
  }
}
