import { sumU32, tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { MAX_NUMBER_OF_PAGES, RESERVED_NUMBER_OF_PAGES } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Initialize some pages of memory for writing for a nested PVM.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/352602352602?v=0.6.4
 */
export class Zero implements HostCallHandler {
  index = tryAsHostCallIndex(23);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.getU64(IN_OUT_REG));
    // `p`: start page
    const pageStart = tryAsU32(regs.getU32(8));
    // `c`: page count
    const pageCount = tryAsU32(regs.getU32(9));

    const endPage = sumU32(pageStart, pageCount);
    const isWithinBounds = pageStart >= RESERVED_NUMBER_OF_PAGES && endPage.value < MAX_NUMBER_OF_PAGES;
    if (endPage.overflow || !isWithinBounds) {
      regs.setU64(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    const zeroResult = await this.refine.machineZeroPages(machineIndex, pageStart, pageCount);

    if (zeroResult.isOk) {
      regs.setU64(IN_OUT_REG, HostCallResult.OK);
    } else {
      regs.setU64(IN_OUT_REG, HostCallResult.WHO);
    }
  }
}
