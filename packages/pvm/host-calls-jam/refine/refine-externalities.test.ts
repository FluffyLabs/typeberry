import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import type { MachineId, RefineExternalities } from "./refine-externalities";

export class TestRefineExt implements RefineExternalities {
  public readonly historicalLookupData: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (key) => key.toString(),
  ]);
  public readonly startMachineData: MultiMap<[BytesBlob, U32], MachineId> = new MultiMap(2, [
    (code) => code.toString(),
    null,
  ]);

  startMachine(code: BytesBlob, programCounter: U32): Promise<MachineId> {
    const val = this.startMachineData.get(code, programCounter);
    if (val === undefined) {
      throw new Error(`Unexpected call to startMachine with: ${code}, ${programCounter}`);
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
