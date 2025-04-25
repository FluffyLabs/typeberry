import { MachineInstance } from "./machine-instance";
import { MachineId } from "./machine-types";

export class MachineManager {
  private machines: Map<MachineId, MachineInstance>;

  constructor() {
    this.machines = new Map<MachineId, MachineInstance>();
  }

  add(machineId: MachineId, instance: MachineInstance): void {
    if (this.machines.has(machineId)) {
      throw new Error("Machine already exists");
    }
    this.machines.set(machineId, instance);
  }

  remove(machineId: MachineId): void {
    if (!this.machines.has(machineId)) {
      throw new Error("Machine not found");
    }
    this.machines.delete(machineId);
  }

  get(machineId: MachineId): MachineInstance | undefined {
    return this.machines.get(machineId);
  }

  getAll(): Map<MachineId, MachineInstance> {
    return this.machines;
  }

  set(machineId: MachineId, instance: MachineInstance): void {
    if (!this.machines.has(machineId)) {
      throw new Error("Machine not found");
    }
    this.machines.set(machineId, instance);
  }
}