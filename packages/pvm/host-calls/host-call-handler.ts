import type { ServiceId } from "@typeberry/block";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { MemoryIndex } from "@typeberry/pvm-interpreter";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { PageFault } from "@typeberry/pvm-interpreter/memory/errors";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/** Strictly-typed host call index. */
export type HostCallIndex = Opaque<U32, "HostCallIndex[U32]">;
/** Attempt to convert a number into `HostCallIndex`. */
export const tryAsHostCallIndex = (v: number): HostCallIndex => asOpaqueType(tryAsU32(v));

export enum PvmExecution {
  Halt = 0,
}

export interface Registers {
  asSigned: Int32Array;
  asUnsigned: Uint32Array;
}

export interface Memory {
  isWriteable(startAddress: MemoryIndex, length: number): boolean;
  loadInto(result: Uint8Array, startAddress: MemoryIndex): null | PageFault;
  storeFrom(address: MemoryIndex, bytes: Uint8Array): null | PageFault;
}

/** An interface for a host call implementation */
export interface HostCallHandler {
  /** Index of that host call (i.e. what PVM invokes via `ecalli`) */
  readonly index: HostCallIndex;

  /** The gas cost of invokation of that host call. */
  readonly gasCost: SmallGas | ((reg: Registers) => Gas);

  /** Currently executing service id. */
  currentServiceId: ServiceId;

  /**
   * Actually execute the host call.
   *
   * NOTE the call is ALLOWED and expected to modify registers and memory.
   */
  execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution>;
}
