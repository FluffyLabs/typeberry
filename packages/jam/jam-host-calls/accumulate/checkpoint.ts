import type { ServiceId } from "@typeberry/block";
import type { HostCallHandler, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import type { RegisterIndex } from "@typeberry/pvm-interpreter/registers.js";
import type { PartialState } from "../externalities/partial-state.js";
import { GasHostCall } from "../gas.js";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/361502361502?v=0.6.6
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(8);
  gasCost = tryAsSmallGas(10);
  tracedRegisters: RegisterIndex[];

  private readonly gasHostCall: GasHostCall;

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {
    this.gasHostCall = new GasHostCall(currentServiceId);
    this.tracedRegisters = this.gasHostCall.tracedRegisters;
  }

  async execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
