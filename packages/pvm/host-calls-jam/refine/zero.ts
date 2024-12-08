import { sumU32, tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { MEMORY_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/** https://graypaper.fluffylabs.dev/#/911af30/333f03333f03 */
const RESERVED_NUMBER_OF_PAGES = 16;
/** https://graypaper.fluffylabs.dev/#/911af30/333f03333f03 */
export const MAX_NUMBER_OF_PAGES = MEMORY_SIZE / 2 ** 12;

/**
 * Initialize some pages of memory for writing for a nested PVM.
 *
 * https://graypaper.fluffylabs.dev/#/911af30/33bf0233bf02
 */
export class Zero implements HostCallHandler {
  index = tryAsHostCallIndex(21);
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
    if (pageStart < RESERVED_NUMBER_OF_PAGES || endPage.overflow || endPage.value >= MAX_NUMBER_OF_PAGES) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    const zeroResult = await this.refine.machineZeroPages(machineIndex, pageStart, pageCount);

    if (zeroResult.isOk) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    } else {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.WHO;
    }
  }
}
