import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";
import {Bytes} from "@typeberry/bytes";

const IN_OUT_REG = 7;

/**
 * Create a new service account.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2e11022e1102
 */
export class New implements HostCallHandler {
  index = tryAsHostCallIndex(9);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `o`
    const codeHashStart = tryAsMemoryIndex(regs.asUnsigned[IN_OUT_REG]);
    // `l`
    const codeLength = tryAsU32(regs.asUnsigned[8]);
    const g_l = tryAsU32(regs.asUnsigned[9]);
    const g_h = tryAsU32(regs.asUnsigned[10]);
    const m_l = tryAsU32(regs.asUnsigned[11]);
    const m_h = tryAsU32(regs.asUnsigned[12]);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(codeHash.raw, codeHashStart);
    if (pageFault !== null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
    }
    const gas = asU64(g_l, g_h);
    const allowance = asU64(m_l, m_h);

    const newServiceId = bump(this.currentServiceId);

    const assignedId = this.partialState.newService(newServiceId, codeHash.asOpaque(), codeLength, gas, allowance);

    if (assignedId.isOk()) {
      regs.asUnsigned[IN_OUT_REG] = assignedId.ok;
    } else {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.CASH;
    }
    return Promise.resolve();
  }
}

function asU64(lower: U32, higher: U32): U64 {
  return tryAsU64((BigInt(higher) << 4n) + BigInt(lower));
}

function bump(serviceId: ServiceId) {
  const mod = 2 ** 32 - 2 ** 9;
  return tryAsServiceId(2 ** 8 + ((serviceId - 2 ** 8 + 42 + mod) % mod));
}
