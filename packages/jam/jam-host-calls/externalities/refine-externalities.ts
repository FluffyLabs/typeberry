import type { Segment, SegmentIndex, ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import type { BigGas, Memory, Registers } from "@typeberry/pvm-interpreter";
import type { ProgramDecoderError } from "@typeberry/pvm-interpreter/program-decoder/program-decoder.js";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import { type OK, type Opaque, type Result, asOpaqueType } from "@typeberry/utils";

/**
 * Program counter is a 64-bit unsigned integer that points to the next instruction
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/2e09012e0901?v=0.6.6
 */
export type ProgramCounter = Opaque<U64, "ProgramCounter[u64]">;
/** Convert a number into ProgramCounter. */
export const tryAsProgramCounter = (v: number | bigint): ProgramCounter => asOpaqueType(tryAsU64(v));

/** Running PVM instance identifier. */
export type MachineId = Opaque<U64, "MachineId[u64]">;
/** Convert a number into PVM instance identifier. */
export const tryAsMachineId = (v: number | bigint): MachineId => asOpaqueType(tryAsU64(v));

export class MachineInstance {
  async run(gas: BigGas, registers: Registers): Promise<MachineResult> {
    return {
      result: {
        status: Status.OK,
      },
      gas,
      registers,
    };
  }
}

export type MachineStatus =
  | {
      status: typeof Status.HOST;
      hostCallIndex: U64;
    }
  | {
      status: typeof Status.FAULT;
      address: U64;
    }
  | {
      status: typeof Status.OK | typeof Status.HALT | typeof Status.PANIC | typeof Status.OOG;
    };

/** Data returned by a machine invocation. */
export type MachineResult = {
  result: MachineStatus;
  gas: BigGas;
  registers: Registers;
};

/** An error that may occur during `peek` or `poke` host call. */
export enum PeekPokeError {
  /** Source page fault. */
  SourcePageFault = 0,
  /** Destination page fault. */
  DestinationPageFault = 1,
  /** No machine under given machine index. */
  NoMachine = 2,
}

export enum ZeroVoidError {
  /** No machine under given machine index. */
  NoMachine = 0,
  /** Attempting to void or zero non-accessible page. */
  InvalidPage = 1,
}

/** Error machine is not found. */
export const NoMachineError = Symbol("Machine index not found.");
export type NoMachineError = typeof NoMachineError;

/** Too many segments already exported. */
export const SegmentExportError = Symbol("Too many segments already exported.");
export type SegmentExportError = typeof SegmentExportError;

/** Host functions external invocations available during refine phase. */
export interface RefineExternalities {
  /** Forget a previously started nested VM. */
  machineExpunge(machineIndex: MachineId): Promise<Result<ProgramCounter, NoMachineError>>;

  /** Set given range of pages as non-accessible and re-initialize them with zeros. */
  machineVoidPages(machineIndex: MachineId, pageStart: U64, pageCount: U64): Promise<Result<OK, ZeroVoidError>>;

  /** Set given range of pages as writeable and initialize them with zeros. */
  machineZeroPages(machineIndex: MachineId, pageStart: U64, pageCount: U64): Promise<Result<OK, ZeroVoidError>>;

  /** Copy a fragment of memory from `machineIndex` into given destination memory. */
  machinePeekFrom(
    machineIndex: MachineId,
    destinationStart: U64,
    sourceStart: U64,
    length: U64,
    destination: Memory,
  ): Promise<Result<OK, PeekPokeError>>;

  /** Write a fragment of memory into `machineIndex` from given source memory. */
  machinePokeInto(
    machineIndex: MachineId,
    sourceStart: U64,
    destinationStart: U64,
    length: U64,
    source: Memory,
  ): Promise<Result<OK, PeekPokeError>>;

  /** Start an inner PVM instance with given entry point and starting code. */
  machineInit(code: BytesBlob, programCounter: ProgramCounter): Promise<Result<MachineId, ProgramDecoderError>>;

  /** Run a previously initialized PVM instance with given gas and registers. */
  machineInvoke(
    machineIndex: MachineId,
    gas: BigGas,
    registers: Registers,
  ): Promise<Result<MachineResult, NoMachineError>>;

  /**
   * Export segment for future retrieval.
   *
   * Returns the index assigned to that segment or an error if there is too many already exported.
   */
  exportSegment(segment: Segment): Result<SegmentIndex, SegmentExportError>;

  /** Lookup a historical preimage. */
  historicalLookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null>;
}
