import type { HostCallHandler, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { GasHostCall } from "../gas";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

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

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
