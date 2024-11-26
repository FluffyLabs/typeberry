import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { Memory } from "@typeberry/pvm-interpreter";
import type { MemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { type Opaque, type Result, asOpaqueType } from "@typeberry/utils";

/**
 * Running PVM instance identifier.
 *
 * TODO [ToDr] [crit] GP does not specify a limit for this,
 * but we do store that in the registers.
 * Most likely it's impossible to have enough gas to keep
 * creating inner PVM instances until this overflows,
 * however a `bigint` might be a safer choice here for 64-bit
 * PVM?
 */
export type MachineId = Opaque<U32, "MachineId[u32]">;
/** Convert a number into PVM instance identifier. */
export const tryAsMachineId = (v: number): MachineId => asOpaqueType(tryAsU32(v));

/** An error that may occur during `peek` host call. */
export enum PeekError {
  /** Source or destination page fault. */
  PageFault = 0,
  /** No machine under given machine index. */
  NoMachine = 1,
}

/** Host functions external invokations available during refine phase. */
export interface RefineExternalities {
  /** Copy a fragment of memory from `machineIndex` into given destination memory. */
  machinePeek(
    machineIndex: MachineId,
    destinationStart: MemoryIndex,
    sourceStart: MemoryIndex,
    length: U32,
    memory: Memory,
  ): Promise<Result<null, PeekError>>;

  /** Start an inner PVM instance with given entry point and starting code. */
  machineStart(code: BytesBlob, programCounter: U32): Promise<MachineId>;

  /** Lookup a historical preimage. */
  historicalLookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}
