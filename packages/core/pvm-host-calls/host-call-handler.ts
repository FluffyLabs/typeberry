import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { type RegisterIndex, tryAsRegisterIndex } from "@typeberry/pvm-interpreter/registers.js";
import { type Opaque, asOpaqueType } from "@typeberry/utils";
import type { IHostCallMemory } from "./host-call-memory.js";
import type { IHostCallRegisters } from "./host-call-registers.js";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex[U32]">;
/** Attempt to convert a number into `HostCallIndex`. */
export const tryAsHostCallIndex = (v: number): HostCallIndex => asOpaqueType(tryAsU32(v));

export enum PvmExecution {
  Halt = 0,
  Panic = 1,
}

/** A utility function to easily trace a bunch of registers. */
export function traceRegisters(...regs: number[]) {
  return regs.map(tryAsRegisterIndex);
}

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  readonly index: HostCallIndex;

  /** The gas cost of invocation of that host call. */
  readonly gasCost: SmallGas | ((reg: IHostCallRegisters) => Gas);

  /** Currently executing service id. */
  readonly currentServiceId: U32;

  /** Input&Output registers that we should add to tracing log. */
  readonly tracedRegisters: RegisterIndex[];

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: GasCounter, regs: IHostCallRegisters, memory: IHostCallMemory): Promise<undefined | PvmExecution>;
}
