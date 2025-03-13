import { SEGMENT_BYTES, type Segment } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { LegacyHostCallResult } from "../results";
import { LEGACY_CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Export a segment to be imported by some future `refine` invokation.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/340b02340b02
 */
export class Export implements HostCallHandler {
  index = tryAsHostCallIndex(16);
  gasCost = tryAsSmallGas(10);
  currentServiceId = LEGACY_CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `p`: segment start address
    const segmentStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));
    // `z`: segment bounded length
    const segmentLength = Math.min(regs.getU32(8), SEGMENT_BYTES);
    // destination (padded with zeros).
    const segment: Segment = Bytes.zero(SEGMENT_BYTES);

    const segmentReadPageFault = memory.loadInto(segment.raw.subarray(0, segmentLength), segmentStart);
    if (segmentReadPageFault !== null) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    // attempt to export a segment and fail if it's above the maximum.
    const segmentExported = this.refine.exportSegment(segment);
    if (segmentExported.isOk) {
      regs.setU32(IN_OUT_REG, segmentExported.ok);
    } else {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.FULL);
    }
    return;
  }
}
