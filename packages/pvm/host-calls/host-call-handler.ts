import {U32} from "@typeberry/numbers";
import {GasCounter, SmallGas} from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import {Opaque} from "@typeberry/utils";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex">;

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  index: HostCallIndex;

  /** The gas cost of invokation of that host call. */
  gastCost: SmallGas | ((reg: Registers) => SmallGas);

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<void>;
}
