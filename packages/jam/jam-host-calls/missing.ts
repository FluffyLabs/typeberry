import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "./results.js";
import { CURRENT_SERVICE_ID } from "./utils.js";

export class Missing implements HostCallHandler {
  index = tryAsHostCallIndex(2 ** 32 - 1);
  basicGasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(7);

  execute(_gas: GasCounter, regs: IHostCallRegisters, _memory: IHostCallMemory): Promise<PvmExecution | undefined> {
    regs.set(7, HostCallResult.WHAT);
    return Promise.resolve(undefined);
  }
}
