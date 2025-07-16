import type { ServiceId } from "@typeberry/block";
import { Logger } from "@typeberry/logger";
import type { HostCallHandler, IHostCallMemory } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls/host-call-registers.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { clampU64ToU32 } from "./utils.js";

const logger = Logger.new(import.meta.filename, "host-calls");
const decoder = new TextDecoder("utf8");

/**
 * Log message to the console
 *
 * https://docs.jamcha.in/knowledge/testing/pvm/host-call-log
 */
export class LogHostCall implements HostCallHandler {
  index = tryAsHostCallIndex(100);
  gasCost = tryAsSmallGas(0);

  constructor(public readonly currentServiceId: ServiceId) {}

  execute(_gas: GasCounter, regs: IHostCallRegisters, memory: IHostCallMemory): Promise<undefined | PvmExecution> {
    const lvl = regs.get(7);
    const targetStart = regs.get(8);
    const targetLength = regs.get(9);
    const msgStart = regs.get(10);
    const msgLength = regs.get(11);

    const target = new Uint8Array(clampU64ToU32(targetLength));
    const message = new Uint8Array(clampU64ToU32(msgLength));
    if (targetStart !== 0n) {
      memory.loadInto(target, targetStart);
    }
    memory.loadInto(message, msgStart);

    logger.log(`[${this.currentServiceId}] [${lvl}] ${decoder.decode(target)} ${decoder.decode(message)}`);
    return Promise.resolve(undefined);
  }
}
