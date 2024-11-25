import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { Gas } from "../gas";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2ecd012ecd01
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(8);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  private readonly gasHostCall: Gas = new Gas();

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: Registers): Promise<undefined | PvmExecution> {
    this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
