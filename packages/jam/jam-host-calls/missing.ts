import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { HostCallResult } from "./results.js";
import { CURRENT_SERVICE_ID } from "./utils.js";

export class Missing implements HostCallHandler {
  index = tryAsHostCallIndex(2 ** 32 - 1);
  basicGasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(7);

  execute(_gas: IGasCounter, regs: HostCallRegisters, _memory: HostCallMemory): Promise<PvmExecution | undefined> {
    regs.set(7, HostCallResult.WHAT);
    return Promise.resolve(undefined);
  }
}
