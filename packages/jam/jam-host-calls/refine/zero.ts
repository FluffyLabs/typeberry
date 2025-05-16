import {
  type HostCallHandler,
  type IHostCallRegisters,
  type PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { type RefineExternalities, tryAsMachineId, ZeroVoidError } from "../externalities/refine-externalities";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { assertNever } from "@typeberry/utils";

const IN_OUT_REG = 7;

/**
 * Initialize some pages of memory for writing for a nested PVM.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/353b00353b00?v=0.6.6
 */
export class Zero implements HostCallHandler {
  index = tryAsHostCallIndex(23);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: IHostCallRegisters): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG));
    // `p`: start page
    const pageStart = regs.get(8);
    // `c`: page count
    const pageCount = regs.get(9);

    const zeroResult = await this.refine.machineZeroPages(machineIndex, pageStart, pageCount);

    if (zeroResult.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = zeroResult.error;

    if (e === ZeroVoidError.NoMachine) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === ZeroVoidError.InvalidPage) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    assertNever(e);
  }
}
