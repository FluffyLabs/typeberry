import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, u64FromParts } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Upgrade the code of the service.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/324401324401
 */
export class Upgrade implements HostCallHandler {
  index = tryAsHostCallIndex(10);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // `o`
    const codeHashStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));
    const g_h = tryAsU32(regs.getU32(8));
    const g_l = tryAsU32(regs.getU32(9));
    const m_h = tryAsU32(regs.getU32(10));
    const m_l = tryAsU32(regs.getU32(11));

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(codeHash.raw, codeHashStart);
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const gas = u64FromParts({ lower: g_l, upper: g_h });
    const allowance = u64FromParts({ lower: m_l, upper: m_h });

    this.partialState.upgradeService(codeHash.asOpaque(), gas, allowance);

    regs.setU32(IN_OUT_REG, HostCallResult.OK);
    return;
  }
}
