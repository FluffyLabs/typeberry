import type { Segment, SegmentIndex, ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { Memory } from "@typeberry/pvm-interpreter";
import type { MemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { type OK, type Opaque, type Result, asOpaqueType } from "@typeberry/utils";

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

/** An error that may occur during `peek` or `poke` host call. */
export enum PeekPokeError {
  /** Source or destination page fault. */
  PageFault = 0,
  /** No machine under given machine index. */
  NoMachine = 1,
}

/** Error for `zero` and `void` host calls when machine is not found. */
export const NoMachineError = Symbol("Machine index not found.");
export type NoMachineError = typeof NoMachineError;

/** Error for `void` host call when there is already a non-accssible page in the range. */
export const InvalidPageError = Symbol("Attempting to void non-accessible page.");
export type InvalidPageError = typeof InvalidPageError;

/** Too many segments already exported. */
export const SegmentExportError = Symbol("Too many segments already exported.");
export type SegmentExportError = typeof SegmentExportError;

/** Host functions external invokations available during refine phase. */
export interface RefineExternalities {
  /** Forget a previously started nested VM. */
  machineExpunge(machineIndex: MachineId): Promise<Result<OK, NoMachineError>>;

  /** Set given range of pages as non-accessible and re-initialize them with zeros. */
  machineVoidPages(
    machineIndex: MachineId,
    pageStart: U32,
    pageCount: U32,
  ): Promise<Result<OK, NoMachineError | InvalidPageError>>;

  /** Set given range of pages as writeable and initialize them with zeros. */
  machineZeroPages(machineIndex: MachineId, pageStart: U32, pageCount: U32): Promise<Result<OK, NoMachineError>>;

  /** Copy a fragment of memory from `machineIndex` into given destination memory. */
  machinePeekFrom(
    machineIndex: MachineId,
    destinationStart: MemoryIndex,
    sourceStart: MemoryIndex,
    length: U32,
    destination: Memory,
  ): Promise<Result<OK, PeekPokeError>>;

  /** Write a fragment of memory into `machineIndex` from given source memory. */
  machinePokeInto(
    machineIndex: MachineId,
    sourceStart: MemoryIndex,
    destinationStart: MemoryIndex,
    length: U32,
    source: Memory,
  ): Promise<Result<OK, PeekPokeError>>;

  /** Start an inner PVM instance with given entry point and starting code. */
  machineStart(code: BytesBlob, programCounter: U32): Promise<MachineId>;

  /**
   * Export segment for future retrieval.
   *
   * Returns the index assigned to that segment or an error if there is too many already exported.
   */
  exportSegment(segment: Segment): Result<SegmentIndex, SegmentExportError>;

  /** Retrieve a segment exported by some earlier refine invokation. */
  importSegment(segmentIndex: SegmentIndex): Promise<Segment | null>;

  /** Lookup a historical preimage. */
  historicalLookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}
