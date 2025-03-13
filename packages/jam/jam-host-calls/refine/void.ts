import { sumU32, tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { assertNever } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { LEGACY_CURRENT_SERVICE_ID } from "../utils";
import { InvalidPageError, NoMachineError, type RefineExternalities, tryAsMachineId } from "./refine-externalities";
import { MAX_NUMBER_OF_PAGES } from "./zero";

const IN_OUT_REG = 7;

/**
 * Mark some pages as unavailable and zero their content.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/352102352102
 */
export class Void implements HostCallHandler {
  index = tryAsHostCallIndex(22);
  gasCost = tryAsSmallGas(10);
  currentServiceId = LEGACY_CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.getU32(IN_OUT_REG));
    // `p`: start page
    const pageStart = tryAsU32(regs.getU32(8));
    // `c`: page count
    const pageCount = tryAsU32(regs.getU32(9));

    const endPage = sumU32(pageStart, pageCount);
    if (endPage.overflow || endPage.value >= MAX_NUMBER_OF_PAGES) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    const voidResult = await this.refine.machineVoidPages(machineIndex, pageStart, pageCount);

    if (voidResult.isOk) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OK);
    } else if (voidResult.error === NoMachineError) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.WHO);
    } else if (voidResult.error === InvalidPageError) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
    } else {
      assertNever(voidResult.error);
    }
  }
}
