import { HostCallHandler } from "@typeberry/pvm-host-calls";
import {Registers, Memory} from "../debugger-adapter";
import {U32} from "@typeberry/numbers";
import {HostCallIndex} from "@typeberry/pvm-host-calls/host-call-handler";

/**
 * Return remaining gas to the PVM.
 *
 * NOTE it should be the gas left is AFTER this function is invoked.
 */
export class Gas implements HostCallHandler {
  index = 0 as HostCallIndex;
  gasCost = 10;

  execute(gas: number, regs: Registers, memory: Memory): Promise<void> {
    throw new Error('todo');
  }
}
