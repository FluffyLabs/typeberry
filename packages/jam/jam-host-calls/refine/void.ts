import { sumU32, tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, type Registers, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { MAX_NUMBER_OF_PAGES, RESERVED_NUMBER_OF_PAGES } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { InvalidPageError, NoMachineError, type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Mark some pages as unavailable and zero their content.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/35d50235d502?v=0.6.4
 */
export class Void implements HostCallHandler {
  index = tryAsHostCallIndex(24);
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
    if (pageStart < RESERVED_NUMBER_OF_PAGES || endPage.overflow || endPage.value >= MAX_NUMBER_OF_PAGES) {
      regs.setU64(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    const voidResult = await this.refine.machineVoidPages(machineIndex, pageStart, pageCount);

    if (voidResult.isOk) {
      regs.setU64(IN_OUT_REG, HostCallResult.OK);
    } else if (voidResult.error === NoMachineError) {
      regs.setU64(IN_OUT_REG, HostCallResult.WHO);
    } else if (voidResult.error === InvalidPageError) {
      regs.setU64(IN_OUT_REG, HostCallResult.HUH);
    } else {
      assertNever(voidResult.error);
    }
  }
}
