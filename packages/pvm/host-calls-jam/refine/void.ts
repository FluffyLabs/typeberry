import { sumU32, tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Registers,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type RefineExternalities, tryAsMachineId, NoMachineError, InvalidPageError } from "./refine-externalities";
import {assertNever} from "@typeberry/utils";
import {MAX_NUMBER_OF_PAGES} from "./zero";

const IN_OUT_REG = 7;

/**
 * Mark some pages as unavailable and zero their content.
 *
 * https://graypaper.fluffylabs.dev/#/5b732de/343b00343b00
 */
export class Void implements HostCallHandler {
  index = tryAsHostCallIndex(22);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.asUnsigned[IN_OUT_REG]);
    // `p`: start page
    const pageStart = tryAsU32(regs.asUnsigned[8]);
    // `c`: page count
    const pageCount = tryAsU32(regs.asUnsigned[9]);

    const endPage = sumU32(pageStart, pageCount);
    if (endPage.overflow || endPage.value >= MAX_NUMBER_OF_PAGES) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    const voidResult = await this.refine.machineVoidPages(
      machineIndex,
      pageStart,
      pageCount,
    );

    if (voidResult.isOk) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    } else if (voidResult.error === NoMachineError) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.WHO;
    } else if (voidResult.error === InvalidPageError) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
    } else {
      assertNever(voidResult.error);
    }
  }
}
