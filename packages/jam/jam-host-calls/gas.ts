import type { ServiceId } from "@typeberry/block";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { logger } from "./logger.js";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/311301311301?v=0.6.6
 */
export class GasHostCall implements HostCallHandler {
  index = tryAsHostCallIndex(0);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(7);

  constructor(public readonly currentServiceId: ServiceId) {}

  execute(gas: IGasCounter, regs: HostCallRegisters): Promise<undefined | PvmExecution> {
    const gasValue = gas.get();
    logger.trace`GAS <- ${gasValue}`;
    regs.set(7, tryAsU64(gasValue));
    return Promise.resolve(undefined);
  }
}
