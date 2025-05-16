import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Create a new service account.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/364602364602?v=0.6.6
 */
export class New implements HostCallHandler {
  index = tryAsHostCallIndex(9);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `o`
    const codeHashStart = regs.get(IN_OUT_REG);
    // `l`
    const codeLength = regs.get(8);
    // `g`
    const gas = regs.get(9);
    // `m`
    const allowance = regs.get(10);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(codeHash.raw, codeHashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const newServiceId = bump(this.currentServiceId);

    const assignedId = this.partialState.newService(newServiceId, codeHash.asOpaque(), codeLength, gas, allowance);

    if (assignedId.isOk) {
      regs.set(IN_OUT_REG, tryAsU64(assignedId.ok));
    } else {
      regs.set(IN_OUT_REG, HostCallResult.CASH);
    }
    return;
  }
}

function bump(serviceId: ServiceId) {
  const mod = 2 ** 32 - 2 ** 9;
  return tryAsServiceId(2 ** 8 + ((serviceId - 2 ** 8 + 42 + mod) % mod));
}
