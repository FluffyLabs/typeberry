import {
  type HostCallHandler,
  type IHostCallRegisters,
  type PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Forget a previously started nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/367d01367d01?v=0.6.4
 */
export class Expunge implements HostCallHandler {
  index = tryAsHostCallIndex(26);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: IHostCallRegisters): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG));

    const expungeResult = await this.refine.machineExpunge(machineIndex);

    if (expungeResult.isOk) {
      regs.set(IN_OUT_REG, expungeResult.ok);
    } else {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
    }

    return;
  }
}
