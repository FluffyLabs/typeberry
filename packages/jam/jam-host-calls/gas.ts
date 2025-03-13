import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, type Registers, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { LEGACY_CURRENT_SERVICE_ID } from "./utils";

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
  currentServiceId = LEGACY_CURRENT_SERVICE_ID;

  execute(gas: GasCounter, regs: Registers): Promise<undefined | PvmExecution> {
    const bigGas = BigInt(gas.get());

    regs.setU64(7, bigGas);

    return Promise.resolve(undefined);
  }
}
