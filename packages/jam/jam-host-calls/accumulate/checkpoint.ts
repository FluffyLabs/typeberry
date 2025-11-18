import type { ServiceId } from "@typeberry/block";
import type { HostCallHandler, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import type { RegisterIndex } from "@typeberry/pvm-interpreter/registers.js";
import type { PartialState } from "../externalities/partial-state.js";
import { GasHostCall } from "../gas.js";
import { logger } from "../logger.js";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/364402364402?v=0.6.7
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(17);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters: RegisterIndex[];

  private readonly gasHostCall: GasHostCall;

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {
    this.gasHostCall = new GasHostCall(currentServiceId);
    this.tracedRegisters = this.gasHostCall.tracedRegisters;
  }

  async execute(gas: IGasCounter, regs: HostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    logger.trace`[${this.currentServiceId}] CHECKPOINT()`;
    return;
  }
}
