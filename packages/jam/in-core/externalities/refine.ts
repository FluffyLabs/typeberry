import type { Segment, SegmentIndex, ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type {
  MachineId,
  MachineResult,
  MemoryOperation,
  NoMachineError,
  PagesError,
  PeekPokeError,
  ProgramCounter,
  RefineExternalities,
  SegmentExportError,
  ZeroVoidError,
} from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import type { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import type { BigGas } from "@typeberry/pvm-interface";
import type { ProgramDecoderError } from "@typeberry/pvm-interpreter";
import type { OK, Result } from "@typeberry/utils";

export class RefineExternalitiesImpl implements RefineExternalities {
  static create() {
    return new RefineExternalitiesImpl();
  }

  private constructor() {}

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

  exportSegment(_segment: Segment): Result<SegmentIndex, SegmentExportError> {
    throw new Error("Method not implemented.");
  }

  historicalLookup(_serviceId: ServiceId | null, _hash: Blake2bHash): Promise<BytesBlob | null> {
    throw new Error("Method not implemented.");
  }
}
