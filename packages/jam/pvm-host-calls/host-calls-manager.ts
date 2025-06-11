import type { ServiceId } from "@typeberry/block";
import { CURRENT_SERVICE_ID, HostCallResult } from "@typeberry/jam-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { check } from "@typeberry/utils";
import {
  type HostCallHandler,
  type HostCallIndex,
  type PvmExecution,
  tryAsHostCallIndex,
} from "./host-call-handler.js";
import type { IHostCallMemory } from "./host-call-memory.js";
import type { IHostCallRegisters } from "./host-call-registers.js";

// TODO [ToDr] Rename to just `HostCalls`
/** Container for all available host calls. */
export class HostCallsManager {
  private readonly hostCalls = Array<HostCallHandler>();
  private readonly missing = new Missing();

  constructor(...hostCallHandler: HostCallHandler[]) {
    for (const handler of hostCallHandler) {
      check(this.hostCalls[handler.index] === undefined, `Overwriting host call handler at index ${handler.index}`);
      this.hostCalls[handler.index] = handler;
    }
  }

  /** Set current service id for all handlers. */
  setServiceId(serviceId: ServiceId) {
    for (const handler of this.hostCalls) {
      handler.currentServiceId = serviceId;
    }
  }

  /** Get a host call by index. */
  get(hostCallIndex: HostCallIndex): HostCallHandler {
    return this.hostCalls[hostCallIndex] ?? this.missing;
  }
}

class Missing implements HostCallHandler {
  index = tryAsHostCallIndex(2 ** 32 - 1);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  execute(_gas: GasCounter, regs: IHostCallRegisters, _memory: IHostCallMemory): Promise<PvmExecution | undefined> {
    regs.set(7, HostCallResult.WHAT);
    return Promise.resolve(undefined);
  }
}
