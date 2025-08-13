import type { ServiceId } from "@typeberry/block";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls/host-call-registers.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/311301311301?v=0.6.6
 */
export class GasHostCall implements HostCallHandler {
  index = tryAsHostCallIndex(0);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(7);

  constructor(public readonly currentServiceId: ServiceId) {}

  execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    regs.set(7, tryAsU64(gas.get()));
    return Promise.resolve(undefined);
  }
}
