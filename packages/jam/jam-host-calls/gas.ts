import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls/host-call-registers";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { CURRENT_SERVICE_ID } from "./utils";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 *
 * https://graypaper.fluffylabs.dev/#/4bb8fd2/2f84012f8401
 */
export class Gas implements HostCallHandler {
  index = tryAsHostCallIndex(0);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  execute(gas: GasCounter, regs: IHostCallRegisters): Promise<undefined | PvmExecution> {
    const bigGas = tryAsU64(gas.get());

    regs.set(7, bigGas);

    return Promise.resolve(undefined);
  }
}
