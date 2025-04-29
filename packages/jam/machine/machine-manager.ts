import type { BytesBlob } from "@typeberry/bytes";
import type { ProgramCounter } from "@typeberry/jam-host-calls/refine/refine-externalities";
import { MachineInterpreter } from "./machine-instance";
import { type MachineId, tryAsMachineId } from "./machine-types";

Przeanalizowane i nie ma potrzeby tego teraz implementować

export class MachineManager {
  private machines: Map<MachineId, MachineInstance>;

  constructor() {
    this.machines = new Map<MachineId, MachineInstance>();
  }

  init(code: BytesBlob, entrypoint: ProgramCounter): void {
    const machine = MachineInstance.new(code, entrypoint);
    const machineId = tryAsMachineId(
      Array.from(this.machines.keys()).reduce(
        (lowestId, currentId) => (lowestId > currentId + 1n ? lowestId : currentId + 1n),
        0n,
      ),
    );
    this.machines.set(machineId, machine);
  }

  remove(machineId: MachineId): boolean {
    return this.machines.delete(machineId);
  }

  get(machineId: MachineId): MachineInstance | undefined {
    return this.machines.get(machineId);
  }
}
