import { SEGMENT_BYTES, type Segment } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import type { RefineExternalities } from "../externalities/refine-externalities";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";

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

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // `p`: segment start address
    const segmentStart = regs.get(IN_OUT_REG);
    // `z`: segment bounded length
    const segmentLengthBig = regs.get(8);
    const segmentLength = segmentLengthBig > BigInt(SEGMENT_BYTES) ? SEGMENT_BYTES : Number(segmentLengthBig);
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
