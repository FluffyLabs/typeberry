import type { ServiceId } from "@typeberry/block";
import type { HostCallHandler, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { GasHostCall } from "../gas.js";

/**
 * Checkpoint the partial state.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/364402364402?v=0.6.7
 */
export class Checkpoint implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(8, {
      [GpVersion.V0_6_7]: 17,
    }),
  );
  gasCost = tryAsSmallGas(10);

  private readonly gasHostCall: GasHostCall;

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {
    this.gasHostCall = new GasHostCall(currentServiceId);
  }

  async execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    await this.gasHostCall.execute(gas, regs);
    this.partialState.checkpoint();
    return;
  }
}
