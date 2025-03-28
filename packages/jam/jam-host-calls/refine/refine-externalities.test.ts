import type { Segment, SegmentIndex, ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import { type BigGas, type Memory, type MemoryIndex, Registers, tryAsBigGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import { type OK, Result } from "@typeberry/utils";
import {
  type MachineId,
  MachineInstance,
  type MachineResult,
  type MachineStatus,
  tryAsMachineId,
} from "./machine-instance";
import {
  type InvalidPageError,
  NoMachineError,
  type PeekPokeError,
  type RefineExternalities,
  type SegmentExportError,
} from "./refine-externalities";

export class TestRefineExt implements RefineExternalities {
  public readonly importSegmentData: Map<SegmentIndex, Segment | null> = new Map();
  public readonly exportSegmentData: MultiMap<[Segment], Result<SegmentIndex, SegmentExportError>> = new MultiMap(1, [
    (segment) => segment.toString(),
  ]);
  public readonly historicalLookupData: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (key) => key.toString(),
  ]);

  public readonly machines: Map<MachineId, MachineInstance> = new Map();
  public readonly machineStartData: MultiMap<[BytesBlob, U32], MachineId> = new MultiMap(2, [
    (code) => code.toString(),
    null,
  ]);
  public readonly machineExpungeData: MultiMap<
    Parameters<TestRefineExt["machineExpunge"]>,
    Result<OK, NoMachineError>
  > = new MultiMap(1);
  public readonly machinePeekData: MultiMap<Parameters<TestRefineExt["machinePeekFrom"]>, Result<OK, PeekPokeError>> =
    new MultiMap(5);
  public readonly machinePokeData: MultiMap<Parameters<TestRefineExt["machinePokeInto"]>, Result<OK, PeekPokeError>> =
    new MultiMap(5);
  public readonly machineVoidPagesData: MultiMap<
    Parameters<TestRefineExt["machineVoidPages"]>,
    Result<OK, NoMachineError | InvalidPageError>
  > = new MultiMap(3);
  public readonly machineZeroPagesData: MultiMap<
    Parameters<TestRefineExt["machineZeroPages"]>,
    Result<OK, NoMachineError>
  > = new MultiMap(3);

  public machineInvokeStatus: MachineStatus = { status: Status.OK };
  public machineInvokeResult: MachineResult = {
    result: { status: Status.OK },
    gas: tryAsBigGas(0n),
    registers: new Registers(),
  };

  machineExpunge(machineIndex: MachineId): Promise<Result<OK, NoMachineError>> {
    const val = this.machineExpungeData.get(machineIndex);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineExpunge with: ${machineIndex}`);
    }
    return Promise.resolve(val);
  }

  machineVoidPages(
    machineIndex: MachineId,
    pageStart: U32,
    pageCount: U32,
  ): Promise<Result<OK, NoMachineError | InvalidPageError>> {
    const val = this.machineVoidPagesData.get(machineIndex, pageStart, pageCount);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineVoidPages with: ${machineIndex}, ${pageStart}, ${pageCount}`);
    }
    return Promise.resolve(val);
  }

  machineZeroPages(machineIndex: MachineId, pageStart: U32, pageCount: U32): Promise<Result<OK, NoMachineError>> {
    const val = this.machineZeroPagesData.get(machineIndex, pageStart, pageCount);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineZeroPages with: ${machineIndex}, ${pageStart}, ${pageCount}`);
    }
    return Promise.resolve(val);
  }

  machineInit(
    code: BytesBlob,
    memory: Memory,
    programCounter: U64,
    { machineId }: { machineId?: MachineId } = {},
  ): Promise<MachineId> {
    if (machineId === undefined) {
      machineId = tryAsMachineId(this.machines.size);
    }
    const machineInstance = new MachineInstance(code, memory, programCounter);
    this.machines.set(machineId, machineInstance);
    return Promise.resolve(machineId);
  }

  machineStart(code: BytesBlob, programCounter: U32): Promise<MachineId> {
    const val = this.machineStartData.get(code, programCounter);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineStart with: ${code}, ${programCounter}`);
    }
    return Promise.resolve(val);
  }

  machinePeekFrom(
    machineIndex: MachineId,
    destinationStart: MemoryIndex,
    sourceStart: MemoryIndex,
    length: U32,
    destination: Memory,
  ): Promise<Result<OK, PeekPokeError>> {
    const val = this.machinePeekData.get(machineIndex, destinationStart, sourceStart, length, destination);
    if (val === undefined) {
      throw new Error(
        `Unexpected call to machinePeekFrom with: ${[machineIndex, destinationStart, sourceStart, length, destination]}`,
      );
    }
    return Promise.resolve(val);
  }

  machinePokeInto(
    machineIndex: MachineId,
    sourceStart: MemoryIndex,
    destinationStart: MemoryIndex,
    length: U32,
    source: Memory,
  ): Promise<Result<OK, PeekPokeError>> {
    const val = this.machinePokeData.get(machineIndex, sourceStart, destinationStart, length, source);
    if (val === undefined) {
      throw new Error(
        `Unexpected call to machinePokeInto with: ${[machineIndex, sourceStart, destinationStart, length, source]}`,
      );
    }
    return Promise.resolve(val);
  }

  async machineInvoke(
    machineIndex: MachineId,
    gas: BigGas,
    registers: Registers,
  ): Promise<Result<MachineResult, NoMachineError>> {
    const machine = this.machines.get(machineIndex);
    if (machine === undefined) {
      return Result.error(NoMachineError, `Machine not found. Call to machineInvoke with: ${machineIndex}`);
    }
    // run machine with given gas and registers
    this.machineInvokeResult = await machine.run(gas, registers);
    // debug purposes
    this.machineInvokeResult.result = this.machineInvokeStatus;
    return Result.ok(this.machineInvokeResult);
  }

  exportSegment(segment: Segment): Result<SegmentIndex, SegmentExportError> {
    const result = this.exportSegmentData.get(segment);
    if (result === undefined) {
      throw new Error(`Unexpected call to exportSegment with: ${segment}`);
    }
    return result;
  }

  importSegment(segmentIndex: SegmentIndex): Promise<Segment | null> {
    const val = this.importSegmentData.get(segmentIndex);
    if (val === undefined) {
      throw new Error(`Unexpected call to importSegment with: ${segmentIndex}`);
    }
    return Promise.resolve(val);
  }

  historicalLookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null> {
    const val = this.historicalLookupData.get(serviceId, hash);
    if (val === undefined) {
      throw new Error(`Unexpected call to historicalLookup with: ${serviceId}, ${hash}`);
    }
    return Promise.resolve(val);
  }
}
