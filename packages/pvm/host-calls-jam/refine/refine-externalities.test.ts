import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import type { Memory, MemoryIndex } from "@typeberry/pvm-interpreter";
import type { Result } from "@typeberry/utils";
import type { InvalidPageError, MachineId, NoMachineError, PeekPokeError, RefineExternalities } from "./refine-externalities";

export class TestRefineExt implements RefineExternalities {
  public readonly historicalLookupData: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (key) => key.toString(),
  ]);
  public readonly machineStartData: MultiMap<[BytesBlob, U32], MachineId> = new MultiMap(2, [
    (code) => code.toString(),
    null,
  ]);
  public readonly machinePeekData: MultiMap<Parameters<TestRefineExt["machinePeekFrom"]>, Result<null, PeekPokeError>> =
    new MultiMap(5);
  public readonly machinePokeData: MultiMap<Parameters<TestRefineExt["machinePokeInto"]>, Result<null, PeekPokeError>> =
    new MultiMap(5);
  public readonly machineZeroPagesData: MultiMap<Parameters<TestRefineExt["machineZeroPages"]>, Result<null, NoMachineError>> =
    new MultiMap(3);
  public readonly machineVoidPagesData: MultiMap<Parameters<TestRefineExt["machineVoidPages"]>, Result<null, NoMachineError | InvalidPageError>> =
    new MultiMap(3);

  machineVoidPages(machineIndex: MachineId, pageStart: U32, pageCount: U32): Promise<Result<null, typeof NoMachineError | InvalidPageError>> {
    const val = this.machineVoidPagesData.get(machineIndex, pageStart, pageCount);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineVoidPages with: ${machineIndex}, ${pageStart}, ${pageCount}`);
    }
    return Promise.resolve(val);
  }

  machineZeroPages(machineIndex: MachineId, pageStart: U32, pageCount: U32): Promise<Result<null, NoMachineError>> {
    const val = this.machineZeroPagesData.get(machineIndex, pageStart, pageCount);
    if (val === undefined) {
      throw new Error(`Unexpected call to machineZeroPages with: ${machineIndex}, ${pageStart}, ${pageCount}`);
    }
    return Promise.resolve(val);
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
  ): Promise<Result<null, PeekPokeError>> {
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
  ): Promise<Result<null, PeekPokeError>> {
    const val = this.machinePokeData.get(machineIndex, sourceStart, destinationStart, length, source);
    if (val === undefined) {
      throw new Error(
        `Unexpected call to machinePokeInto with: ${[machineIndex, sourceStart, destinationStart, length, source]}`,
      );
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
