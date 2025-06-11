import type { HostCallHandler, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import type { PartialState } from "../externalities/partial-state.js";
import { GasHostCall } from "../gas.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/361502361502?v=0.6.6
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(8);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  private readonly gasHostCall: GasHostCall = new GasHostCall();

  constructor(private readonly partialState: PartialState) {}

  async execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
