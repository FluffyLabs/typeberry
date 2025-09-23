import {
  type HostCallHandler,
  type IHostCallRegisters,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { resultToString } from "@typeberry/utils";
import { type RefineExternalities, tryAsMachineId } from "../externalities/refine-externalities.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Forget a previously started nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/358502358502?v=0.6.7
 */
export class Expunge implements HostCallHandler {
  index = tryAsHostCallIndex(13);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG);

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: IHostCallRegisters): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG));

    const expungeResult = await this.refine.machineExpunge(machineIndex);
    logger.trace`EXPUNGE(${machineIndex}) <- ${resultToString(expungeResult)}`;

    if (expungeResult.isOk) {
      regs.set(IN_OUT_REG, expungeResult.ok);
    } else {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
    }

    return;
  }
}
