import {
  type HostCallHandler,
  type IHostCallRegisters,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { type RefineExternalities, tryAsMachineId } from "../externalities/refine-externalities.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Forget a previously started nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/35e70235e702?v=0.6.6
 */
export class Expunge implements HostCallHandler {
  index = tryAsHostCallIndex(26);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG);

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
