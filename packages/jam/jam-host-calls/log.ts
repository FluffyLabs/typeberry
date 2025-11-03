import type { ServiceId } from "@typeberry/block";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { safeAllocUint8Array } from "@typeberry/utils";
import { logger } from "./logger.js";
import { clampU64ToU32 } from "./utils.js";

const decoder = new TextDecoder("utf8");

enum Levels {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  DEBUG = 3,
  NIT = 4
};

/**
 * Log message to the console
 *
 * https://docs.jamcha.in/knowledge/testing/pvm/host-call-log
 */
export class LogHostCall implements HostCallHandler {
  index = tryAsHostCallIndex(100);
  basicGasCost = tryAsSmallGas(0);
  // intentionally not tracing anything here, since the message will be printed anyway.
  tracedRegisters = traceRegisters();

  constructor(public readonly currentServiceId: ServiceId) {}

  execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    const lvl = regs.get(7);
    const targetStart = regs.get(8);
    const targetLength = regs.get(9);
    const msgStart = regs.get(10);
    const msgLength = regs.get(11);

    const target = safeAllocUint8Array(clampU64ToU32(targetLength));
    const message = safeAllocUint8Array(clampU64ToU32(msgLength));
    if (targetStart !== 0n) {
      memory.loadInto(target, targetStart);
    }
    memory.loadInto(message, msgStart);

    logger.trace`LOG(${this.currentServiceId}, ${Levels[Number(lvl)]}, ${decoder.decode(target)}, ${decoder.decode(message)})`;
    return Promise.resolve(undefined);
  }
}
