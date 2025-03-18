import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { tryAsMachineId } from "./machine-instance";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Forget a previously started nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/367c01367c01
 */
export class Expunge implements HostCallHandler {
  index = tryAsHostCallIndex(24);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.getU32(IN_OUT_REG));

    const expungeResult = await this.refine.machineExpunge(machineIndex);

    if (expungeResult.isOk) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OK);
    } else {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.WHO);
    }

    return Promise.resolve(undefined);
  }
}
