import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, u64FromParts } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Upgrade the code of the service.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2e01032e0103
 */
export class Upgrade implements HostCallHandler {
  index = tryAsHostCallIndex(10);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `o`
    const codeHashStart = tryAsMemoryIndex(regs.asUnsigned[IN_OUT_REG]);
    const g_h = tryAsU32(regs.asUnsigned[8]);
    const g_l = tryAsU32(regs.asUnsigned[9]);
    const m_h = tryAsU32(regs.asUnsigned[10]);
    const m_l = tryAsU32(regs.asUnsigned[11]);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(codeHash.raw, codeHashStart);
    if (pageFault !== null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return Promise.resolve();
    }

    const gas = u64FromParts({ lower: g_l, upper: g_h });
    const allowance = u64FromParts({ lower: m_l, upper: m_h });

    this.partialState.upgrade(codeHash.asOpaque(), gas, allowance);

    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    return Promise.resolve();
  }
}
