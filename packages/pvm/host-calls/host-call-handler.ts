import type { ServiceId } from "@typeberry/block";
import type { U32 } from "@typeberry/numbers";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import type { Opaque } from "@typeberry/utils";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex[U32]">;

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  index: HostCallIndex;

  /** The gas cost of invokation of that host call. */
  gasCost: SmallGas | ((reg: Registers) => SmallGas);

  /** Currently executing service id. */
  currentServiceId: ServiceId;

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<void>;
}
