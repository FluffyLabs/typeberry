import {
  type HostCallHandler,
  type HostCallRegisters,
  type PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { assertNever, resultToString } from "@typeberry/utils";
import {
  PagesError,
  type RefineExternalities,
  toMemoryOperation,
  tryAsMachineId,
} from "../externalities/refine-externalities.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Manipulates memory pages by setting access rights (unreadable, readable, writable).
 * Can preserve existing data or zero out the memory.
 *
 * https://graypaper.fluffylabs.dev/#/1c979cb/349602349602?v=0.7.1
 */
export class Pages implements HostCallHandler {
  index = tryAsHostCallIndex(11);
  basicGasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10);

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG));
    // `p`: start page
    const pageStart = regs.get(8);
    // `c`: page count
    const pageCount = regs.get(9);
    // `r`: request type
    const requestType = toMemoryOperation(regs.get(10));

    const pagesResult = await this.refine.machinePages(machineIndex, pageStart, pageCount, requestType);
    logger.trace`PAGES(${machineIndex}, ${pageStart}, ${pageCount}, ${requestType}) <- ${resultToString(pagesResult)}`;

    if (pagesResult.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = pagesResult.error;

    if (e === PagesError.NoMachine) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === PagesError.InvalidOperation || e === PagesError.InvalidPage) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    assertNever(e);
  }
}
