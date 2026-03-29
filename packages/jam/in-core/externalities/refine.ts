import {
  MAX_NUMBER_OF_EXPORTS_WP,
  type Segment,
  type SegmentIndex,
  type ServiceId,
  tryAsSegmentIndex,
} from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import {
  type MachineId,
  type MachineResult,
  type MemoryOperation,
  type NoMachineError,
  type PagesError,
  type PeekPokeError,
  type ProgramCounter,
  type RefineExternalities,
  SegmentExportError,
  type ZeroVoidError,
} from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import type { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import type { BigGas } from "@typeberry/pvm-interface";
import type { ProgramDecoderError } from "@typeberry/pvm-interpreter";
import type { State } from "@typeberry/state";
import { type OK, Result } from "@typeberry/utils";

/**
 * Parameters required to create a RefineExternalitiesImpl.
 */
export type RefineExternalitiesParams = {
  /** The service currently being refined. */
  currentServiceId: ServiceId;
  /** State at the lookup anchor block, used for historical preimage lookups. */
  lookupState: State;
  /** Export offset -- sum of exports from prior work items in this package. */
  exportOffset: number;
};

export class RefineExternalitiesImpl implements RefineExternalities {
  /** Service being refined (used as default for historicalLookup). */
  private readonly currentServiceId: ServiceId;
  /** State at the lookup anchor for preimage lookups. */
  private readonly lookupState: State;
  /** Segments exported by this work item during refinement. */
  private readonly exportedSegments: Segment[] = [];
  /** Offset for segment indexing (sum of exports from prior items). */
  private readonly exportOffset: number;

  static create(params: RefineExternalitiesParams) {
    return new RefineExternalitiesImpl(params);
  }

  private constructor(params: RefineExternalitiesParams) {
    this.currentServiceId = params.currentServiceId;
    this.lookupState = params.lookupState;
    this.exportOffset = params.exportOffset;
  }

  getExportedSegments(): readonly Segment[] {
    return this.exportedSegments;
  }

  machineExpunge(_machineIndex: MachineId): Promise<Result<ProgramCounter, NoMachineError>> {
    throw new Error("Method not implemented.");
  }

  machinePages(
    _machineIndex: MachineId,
    _pageStart: U64,
    _pageCount: U64,
    _requestType: MemoryOperation | null,
  ): Promise<Result<OK, PagesError>> {
    throw new Error("Method not implemented.");
  }

  machineVoidPages(_machineIndex: MachineId, _pageStart: U64, _pageCount: U64): Promise<Result<OK, ZeroVoidError>> {
    throw new Error("Method not implemented.");
  }

  machineZeroPages(_machineIndex: MachineId, _pageStart: U64, _pageCount: U64): Promise<Result<OK, ZeroVoidError>> {
    throw new Error("Method not implemented.");
  }

  machinePeekFrom(
    _machineIndex: MachineId,
    _destinationStart: U64,
    _sourceStart: U64,
    _length: U64,
    _destination: HostCallMemory,
  ): Promise<Result<OK, PeekPokeError>> {
    throw new Error("Method not implemented.");
  }

  machinePokeInto(
    _machineIndex: MachineId,
    _sourceStart: U64,
    _destinationStart: U64,
    _length: U64,
    _source: HostCallMemory,
  ): Promise<Result<OK, PeekPokeError>> {
    throw new Error("Method not implemented.");
  }

  machineInit(_code: BytesBlob, _programCounter: ProgramCounter): Promise<Result<MachineId, ProgramDecoderError>> {
    throw new Error("Method not implemented.");
  }

  machineInvoke(
    _machineIndex: MachineId,
    _gas: BigGas,
    _registers: HostCallRegisters,
  ): Promise<Result<MachineResult, NoMachineError>> {
    throw new Error("Method not implemented.");
  }

  exportSegment(segment: Segment): Result<SegmentIndex, SegmentExportError> {
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/335d03335d03?v=0.7.2
    const currentIndex = this.exportOffset + this.exportedSegments.length;
    if (currentIndex >= MAX_NUMBER_OF_EXPORTS_WP) {
      return Result.error(
        SegmentExportError,
        () =>
          `Maximum number of exported segments exceeded (offset: ${this.exportOffset}, exported: ${this.exportedSegments.length})`,
      );
    }
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/337303337303?v=0.7.2
    this.exportedSegments.push(segment);
    return Result.ok(tryAsSegmentIndex(currentIndex));
  }

  historicalLookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/33d70133f901?v=0.7.2
    const sid = serviceId ?? this.currentServiceId;
    const service = this.lookupState.getService(sid);
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/334802334802?v=0.7.2
    if (service === null) {
      return Promise.resolve(null);
    }
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/334f02334f02?v=0.7.2
    return Promise.resolve(service.getPreimage(hash.asOpaque()));
  }
}
