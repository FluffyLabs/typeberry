import type { ServiceId } from "@typeberry/block";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls/host-call-registers.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";

/**
 * Currently noop, in future it can log something.
 * It exists becase to calculate used gas correctly
 */
export class LogHostCall implements HostCallHandler {
  index = tryAsHostCallIndex(100);
  gasCost = tryAsSmallGas(0);

  constructor(public readonly currentServiceId: ServiceId) {}

  execute(_gas: GasCounter, _regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    return Promise.resolve(undefined);
  }
}
