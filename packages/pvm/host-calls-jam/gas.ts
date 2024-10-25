import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Registers } from "../debugger-adapter";

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

  execute(gas: GasCounter, regs: Registers): Promise<void> {
    // TODO [ToDr] Assuming the gas has been already deducted!
    const bigGas = BigInt(gas.get());
    const upper = bigGas >> 32n;
    const lower = bigGas & 0xffffffffn;

    regs.asUnsigned[7] = Number(lower);
    regs.asUnsigned[8] = Number(upper);

    return Promise.resolve();
  }
}
