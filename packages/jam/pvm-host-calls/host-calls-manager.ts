import { CURRENT_SERVICE_ID, HostCallResult } from "@typeberry/jam-host-calls";
import { Logger } from "@typeberry/logger";
import { type Gas, type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { check } from "@typeberry/utils";
import {
  type HostCallHandler,
  type HostCallIndex,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "./host-call-handler.js";
import type { IHostCallMemory } from "./host-call-memory.js";
import type { IHostCallRegisters } from "./host-call-registers.js";

const logger = Logger.new(import.meta.filename, "host-calls");

// TODO [ToDr] Rename to just `HostCalls`
/** Container for all available host calls. */
export class HostCallsManager {
  private readonly hostCalls = new Map<HostCallIndex, HostCallHandler>();
  private readonly missing = new Missing();

  constructor(...hostCallHandlers: HostCallHandler[]) {
    for (const handler of hostCallHandlers) {
      check(this.hostCalls.get(handler.index) === undefined, `Overwriting host call handler at index ${handler.index}`);
      this.hostCalls.set(handler.index, handler);
    }
  }

  /** Get a host call by index. */
  get(hostCallIndex: HostCallIndex): HostCallHandler {
    return this.hostCalls.get(hostCallIndex) ?? this.missing;
  }

  traceHostCall(
    context: string,
    hostCallIndex: HostCallIndex,
    hostCallHandler: HostCallHandler,
    registers: IHostCallRegisters,
    gas: Gas,
  ) {
    const { currentServiceId } = hostCallHandler;
    const requested = hostCallIndex !== hostCallHandler.index ? ` (${hostCallIndex})` : "";
    const name = `${hostCallHandler.constructor.name}:${hostCallHandler.index}`;
    const registerValues = hostCallHandler.tracedRegisters
      .map((idx) => [idx.toString().padStart(2, "0"), registers.get(idx)] as const)
      .filter((v) => v[1] !== 0n)
      .map(([idx, value]) => {
        return `r${idx}=${value} (0x${value.toString(16)})`;
      })
      .join(", ");
    logger.trace(`[${currentServiceId}] ${context} ${name}${requested}.  Gas: ${gas}. Regs: ${registerValues}.`);
  }
}

class Missing implements HostCallHandler {
  index = tryAsHostCallIndex(2 ** 32 - 1);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(7);

  execute(_gas: GasCounter, regs: IHostCallRegisters, _memory: IHostCallMemory): Promise<PvmExecution | undefined> {
    regs.set(7, HostCallResult.WHAT);
    return Promise.resolve(undefined);
  }
}
