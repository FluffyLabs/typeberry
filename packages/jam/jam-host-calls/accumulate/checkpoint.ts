import type { HostCallHandler, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { Gas } from "../gas";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/4bb8fd2/311502311502
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(8);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  private readonly gasHostCall: Gas = new Gas();

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: HostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
