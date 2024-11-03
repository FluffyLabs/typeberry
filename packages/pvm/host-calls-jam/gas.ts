import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { CURRENT_SERVICE_ID } from "./utils";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/2c6c012c6c01
 */
export class Gas implements HostCallHandler {
  index = 0 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = CURRENT_SERVICE_ID;

  execute(gas: GasCounter, regs: Registers): Promise<void> {
    const bigGas = BigInt(gas.get());
    const upper = bigGas >> 32n;
    const lower = bigGas & 0xffffffffn;

    regs.asUnsigned[7] = Number(lower);
    regs.asUnsigned[8] = Number(upper);

    return Promise.resolve();
  }
}
