import { W_E, W_S } from "@typeberry/block/gp-constants";
import { isU16 } from "@typeberry/numbers";
import { type HostCallHandler, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { asOpaqueType } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;
const MAX_EC_SEGMENT_BYTES = W_E * W_S;

/**
 * Import a segment that was exported by some previous `refine` of the current service.
 *
 * https://graypaper.fluffylabs.dev/#/911af30/328202328202
 */
export class Import implements HostCallHandler {
  index = tryAsHostCallIndex(16);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // idx
    const segmentIndex = regs.asUnsigned[IN_OUT_REG];
    // `o`: destination start
    const destinationStart = tryAsMemoryIndex(regs.asUnsigned[8]);
    // `l`: destination length
    const destinationLen = Math.min(regs.asUnsigned[9], MAX_EC_SEGMENT_BYTES);

    // we check writeability separately in case the `|v| < l`
    // i.e. the `store` would succeed, but some cell at `|v|...l`
    // would cause a page fault.
    const destinationWriteable = memory.isWriteable(destinationStart, destinationLen);
    if (!destinationWriteable) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    const segment = isU16(segmentIndex) ? await this.refine.importSegment(asOpaqueType(segmentIndex)) : null;
    if (segment === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return;
    }

    const l = Math.min(segment.length, destinationLen);
    const storeFault = memory.storeFrom(destinationStart, segment.raw.subarray(0, l));
    if (storeFault !== null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    return;
  }
}
