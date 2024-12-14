import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Forget a previously started nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/5b732de/343102343102
 */
export class Expunge implements HostCallHandler {
  index = tryAsHostCallIndex(24);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.asUnsigned[IN_OUT_REG]);

    const expungeResult = await this.refine.machineExpunge(machineIndex);

    if (expungeResult.isOk) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    } else {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.WHO;
    }

    return Promise.resolve(undefined);
  }
}
