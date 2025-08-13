import {
  type HostCallHandler,
  type IHostCallRegisters,
  type PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { Compatibility, GpVersion, assertNever } from "@typeberry/utils";
import { PagesError, type RefineExternalities, tryAsMachineId } from "../externalities/refine-externalities.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Manipulates memory pages by setting access rights (unreadable, readable, writable).
 * Can preserve existing data or zero out the memory.
 *
 * `Void = 0`: Zeroes memory and set access to unreadable.
 * `ZeroRead = 1`: Zeroes memory and set access to read-only.
 * `ZeroWrite = 2`: Zeroes memory and set access to read-write.
 * `Read = 3`: Preserve memory and set access to read-only.
 * `Write = 4`: Preserve memory and set access to read-write.
 *
 * https://graypaper.fluffylabs.dev/#/1c979cb/349602349602?v=0.7.1
 */
export class Pages implements HostCallHandler {
  // TODO [MaSo] Change to this when PR #540 is merged
  // index = tryAsHostCallIndex(
  //   Compatibility.selectIfGreaterOrEqual(-1, {
  //     [GpVersion.V0_6_7]: 11,
  //   }),
  // );
  index = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsHostCallIndex(11) : tryAsHostCallIndex(-1);
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
    // `r`: request type
    const requestType = regs.get(10);

    const pagesResult = await this.refine.machinePages(machineIndex, pageStart, pageCount, requestType);

    if (pagesResult.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = pagesResult.error;

    if (e === PagesError.NoMachine) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === PagesError.InvalidRequest || e === PagesError.UninitializedPage) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    assertNever(e);
  }
}
