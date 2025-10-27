import { tryAsU32, type U32 } from "@typeberry/numbers";
import type { Gas, IGasCounter, SmallGas } from "@typeberry/pvm-interface";
import { type RegisterIndex, tryAsRegisterIndex } from "@typeberry/pvm-interpreter/registers.js";
import { asOpaqueType, type Opaque } from "@typeberry/utils";
import type { HostCallMemory } from "./host-call-memory.js";
import type { HostCallRegisters } from "./host-call-registers.js";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex[U32]">;
/** Attempt to convert a number into `HostCallIndex`. */
export const tryAsHostCallIndex = (v: number): HostCallIndex => asOpaqueType(tryAsU32(v));

/**
 * Host-call exit reason.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/24a30124a501?v=0.7.2
 */
export enum PvmExecution {
  Halt = 0,
  Panic = 1,
  OOG = 2, // out-of-gas
}

/** A utility function to easily trace a bunch of registers. */
export function traceRegisters(...regs: number[]) {
  return regs.map(tryAsRegisterIndex);
}

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  readonly index: HostCallIndex;

  /**
   * The gas cost of invocation of that host call.
   *
   * NOTE: `((reg: HostCallRegisters) => Gas)` function is for compatibility reasons: pre GP 0.7.2
   */
  readonly basicGasCost: SmallGas | ((reg: HostCallRegisters) => Gas);

  /** Currently executing service id. */
  readonly currentServiceId: U32;

  /** Input&Output registers that we should add to tracing log. */
  readonly tracedRegisters: RegisterIndex[];

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution>;
}
