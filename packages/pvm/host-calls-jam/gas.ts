import { HostCallHandler } from "@typeberry/pvm-host-calls";
import {Registers, Memory} from "../debugger-adapter";
import {HostCallIndex} from "@typeberry/pvm-host-calls/host-call-handler";
import {GasCounter, SmallGas} from "@typeberry/pvm-interpreter/gas";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 */
export class Gas implements HostCallHandler {
  index = 0 as HostCallIndex;
  gasCost = 10 as SmallGas;

  execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    throw new Error('todo');
  }
}
