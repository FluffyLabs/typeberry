import type { ServiceId } from "@typeberry/block";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Opaque, asOpaqueType } from "@typeberry/utils";
import type { HostCallMemory } from "./host-call-memory";
import type { HostCallRegisters } from "./host-call-registers";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex[U32]">;
/** Attempt to convert a number into `HostCallIndex`. */
export const tryAsHostCallIndex = (v: number): HostCallIndex => asOpaqueType(tryAsU32(v));

export enum PvmExecution {
  Halt = 0,
  Panic = 1,
}

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  readonly index: HostCallIndex;

  /** The gas cost of invocation of that host call. */
  readonly gasCost: SmallGas | ((reg: HostCallRegisters) => Gas);

  /** Currently executing service id. */
  currentServiceId: ServiceId;

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution>;
}
