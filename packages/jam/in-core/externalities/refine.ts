import {
  MAX_NUMBER_OF_EXPORTS_WP,
  type Segment,
  type SegmentIndex,
  type ServiceId,
  tryAsSegmentIndex,
} from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { SortedArray } from "@typeberry/collections";
import type { PvmBackend } from "@typeberry/config";
import type { Blake2bHash } from "@typeberry/hash";
import {
  type MachineId,
  type MachineResult,
  type MachineStatus,
  type MemoryOperation,
  NoMachineError,
  type PagesError,
  type PeekPokeError,
  type ProgramCounter,
  type RefineExternalities,
  SegmentExportError,
  tryAsMachineId,
  tryAsProgramCounter,
  type ZeroVoidError,
} from "@typeberry/jam-host-calls";
import { tryAsU64, type U64 } from "@typeberry/numbers";
import { Ordering } from "@typeberry/ordering";
import { type HostCallMemory, HostCallRegisters, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import { type BigGas, type IPvmInterpreter, Status, tryAsBigGas, tryAsGas } from "@typeberry/pvm-interface";
import { ProgramDecoder, type ProgramDecoderError } from "@typeberry/pvm-interpreter";
import type { State } from "@typeberry/state";
import { type OK, Result } from "@typeberry/utils";

type MachineEntry = [MachineId, IPvmInterpreter];

/** Used when searching by MachineId only — the comparator ignores this field. */
const NULL_INTERPRETER = undefined as unknown as IPvmInterpreter;

const machineComparator = (a: MachineEntry, b: MachineEntry) => {
  if (a[0] < b[0]) {
    return Ordering.Less;
  }
  if (a[0] > b[0]) {
    return Ordering.Greater;
  }
  return Ordering.Equal;
};

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
  /**
   * PVM backend to use for creating inner PVM instances.
   * NIT: Could accept PVMInstanceManager
   */
  pvmBackend: PvmBackend;
};

export class RefineExternalitiesImpl implements RefineExternalities {
  /** Inner PVM instances sorted by MachineId. */
  private machines: SortedArray<MachineEntry> = SortedArray.fromSortedArray(machineComparator);
  /** Service being refined (used as default for historicalLookup). */
  private readonly currentServiceId: ServiceId;
  /** State at the lookup anchor for preimage lookups. */
  private readonly lookupState: State;
  /** Segments exported by this work item during refinement. */
  private readonly exportedSegments: Segment[] = [];
  /** Offset for segment indexing (sum of exports from prior items). */
  private readonly exportOffset: number;
  /** PVM backend for creating inner machines. */
  private readonly pvmBackend: PvmBackend;

  static create(params: RefineExternalitiesParams) {
    return new RefineExternalitiesImpl(params);
  }

  private constructor(params: RefineExternalitiesParams) {
    this.currentServiceId = params.currentServiceId;
    this.lookupState = params.lookupState;
    this.exportOffset = params.exportOffset;
    this.pvmBackend = params.pvmBackend;
  }

  getExportedSegments(): readonly Segment[] {
    return this.exportedSegments;
  }

  machineExpunge(machineIndex: MachineId): Promise<Result<ProgramCounter, NoMachineError>> {
    // We just care about machineIndex
    const entry = this.machines.findExact([machineIndex, NULL_INTERPRETER]);
    if (entry === undefined) {
      return Promise.resolve(Result.error(NoMachineError, () => `Machine not found (id: ${machineIndex})`));
    }
    const pc = tryAsProgramCounter(entry[1].getPC());
    this.machines.removeOne(entry);
    return Promise.resolve(Result.ok(pc));
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

  async machineInit(code: BytesBlob, programCounter: ProgramCounter): Promise<Result<MachineId, ProgramDecoderError>> {
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/346400346400?v=0.7.2
    const deblobResult = ProgramDecoder.deblob(code.raw);
    if (deblobResult.isError) {
      return Result.error(deblobResult.error, deblobResult.details);
    }

    const manager = await PvmInstanceManager.new(this.pvmBackend);
    const innerPvm = await manager.getInstance();

    innerPvm.resetGeneric(code.raw, Number(programCounter), tryAsGas(0));

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/348c00348c00?v=0.7.2
    // Binary search for the minimal free MachineId
    const arr = this.machines.array;
    let low = 0;
    let high = arr.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (arr[mid][0] > BigInt(mid)) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    const machineId = tryAsMachineId(low);
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/340501340b01?v=0.7.2
    this.machines.insert([machineId, innerPvm]);
    return Result.ok(machineId);
  }

  machineInvoke(
    machineIndex: MachineId,
    gas: BigGas,
    registers: HostCallRegisters,
  ): Promise<Result<MachineResult, NoMachineError>> {
    const entry = this.machines.findExact([machineIndex, NULL_INTERPRETER]);
    if (entry === undefined) {
      return Promise.resolve(Result.error(NoMachineError, () => `Machine not found (id: ${machineIndex})`));
    }

    const innerPvm = entry[1];

    // Prepare inner PVM
    innerPvm.registers.setAllEncoded(registers.getEncoded());
    innerPvm.gas.set(gas);

    // Execute program
    innerPvm.runProgram();

    // Status
    const status = innerPvm.getStatus();
    const exitParam = innerPvm.getExitParam() ?? 0;
    const remainingGas = tryAsBigGas(innerPvm.gas.get());
    const outRegisters = new HostCallRegisters(new Uint8Array(innerPvm.registers.getAllEncoded()));

    let machineStatus: MachineStatus;
    if (status === Status.HOST) {
      machineStatus = { status, hostCallIndex: tryAsU64(exitParam) };
    } else if (status === Status.FAULT) {
      machineStatus = { status, address: tryAsU64(exitParam) };
    } else {
      machineStatus = { status };
    }

    return Promise.resolve(Result.ok({ result: machineStatus, gas: remainingGas, registers: outRegisters }));
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
