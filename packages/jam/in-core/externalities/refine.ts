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

  machineExpunge(machineIndex: MachineId): Promise<Result<ProgramCounter, NoMachineError>> {
    throw new Error("Method not implemented.");
  }

  machinePages(
    machineIndex: MachineId,
    pageStart: U64,
    pageCount: U64,
    requestType: MemoryOperation | null,
  ): Promise<Result<OK, PagesError>> {
    throw new Error("Method not implemented.");
  }

  machineVoidPages(machineIndex: MachineId, pageStart: U64, pageCount: U64): Promise<Result<OK, ZeroVoidError>> {
    throw new Error("Method not implemented.");
  }

  machineZeroPages(machineIndex: MachineId, pageStart: U64, pageCount: U64): Promise<Result<OK, ZeroVoidError>> {
    throw new Error("Method not implemented.");
  }

  machinePeekFrom(
    machineIndex: MachineId,
    destinationStart: U64,
    sourceStart: U64,
    length: U64,
    destination: HostCallMemory,
  ): Promise<Result<OK, PeekPokeError>> {
    throw new Error("Method not implemented.");
  }

  machinePokeInto(
    machineIndex: MachineId,
    sourceStart: U64,
    destinationStart: U64,
    length: U64,
    source: HostCallMemory,
  ): Promise<Result<OK, PeekPokeError>> {
    throw new Error("Method not implemented.");
  }

  machineInit(code: BytesBlob, programCounter: ProgramCounter): Promise<Result<MachineId, ProgramDecoderError>> {
    throw new Error("Method not implemented.");
  }

  machineInvoke(
    machineIndex: MachineId,
    gas: BigGas,
    registers: HostCallRegisters,
  ): Promise<Result<MachineResult, NoMachineError>> {
    throw new Error("Method not implemented.");
  }

  exportSegment(segment: Segment): Result<SegmentIndex, SegmentExportError> {
    throw new Error("Method not implemented.");
  }

  historicalLookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    throw new Error("Method not implemented.");
  }
}
