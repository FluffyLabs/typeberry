import { Logger } from "@typeberry/logger";
import { tryAsU32 } from "@typeberry/numbers";
import { type Gas, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { check } from "@typeberry/utils";
import {
  type HostCallHandler,
  type HostCallIndex,
  type PvmExecution,
  tryAsHostCallIndex,
} from "./host-call-handler.js";
import type { IHostCallRegisters } from "./host-call-registers.js";

const logger = Logger.new(import.meta.filename, "host-calls-pvm");

/** Container for all available host calls. */
export class HostCallsManager {
  private readonly hostCalls = new Map<HostCallIndex, HostCallHandler>();
  private readonly missing;

  constructor({
    missing,
    handlers = [],
  }: {
    missing: HostCallHandler;
    handlers?: HostCallHandler[];
  }) {
    this.missing = missing;

    for (const handler of handlers) {
      check`${this.hostCalls.get(handler.index) === undefined} Overwriting host call handler at index ${handler.index}`;
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
    logger.insane(`[${currentServiceId}] ${context} ${name}${requested}.  Gas: ${gas}. Regs: ${registerValues}.`);
  }
}

export class NoopMissing implements HostCallHandler {
  index = tryAsHostCallIndex(2 ** 32 - 1);
  basicGasCost = tryAsSmallGas(0);
  currentServiceId = tryAsU32(0);
  tracedRegisters = [];

  async execute(): Promise<undefined | PvmExecution> {
    return;
  }
}
