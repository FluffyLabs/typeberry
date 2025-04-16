import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, type Registers, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Create a new service account.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/323f00323f00
 */
export class New implements HostCallHandler {
  index = tryAsHostCallIndex(9);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // `o`
    const codeHashStart = tryAsMemoryIndex(regs.getLowerU32(IN_OUT_REG));
    // `l`
    const codeLength = tryAsU32(regs.getLowerU32(8));
    const g_l = tryAsU32(regs.getLowerU32(9));
    const g_h = tryAsU32(regs.getLowerU32(10));
    const m_l = tryAsU32(regs.getLowerU32(11));
    const m_h = tryAsU32(regs.getLowerU32(12));

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const readResult = memory.loadInto(codeHash.raw, codeHashStart);
    if (readResult.isError) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    const gas = asU64(g_l, g_h);
    const allowance = asU64(m_l, m_h);

    const newServiceId = bump(this.currentServiceId);

    const assignedId = this.partialState.newService(newServiceId, codeHash.asOpaque(), codeLength, gas, allowance);

    if (assignedId.isOk) {
      regs.setU32(IN_OUT_REG, assignedId.ok);
    } else {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.CASH);
    }
    return;
  }
}

function asU64(lower: U32, higher: U32) {
  return tryAsU64((BigInt(higher) << 32n) + BigInt(lower));
}

function bump(serviceId: ServiceId) {
  const mod = 2 ** 32 - 2 ** 9;
  return tryAsServiceId(2 ** 8 + ((serviceId - 2 ** 8 + 42 + mod) % mod));
}
