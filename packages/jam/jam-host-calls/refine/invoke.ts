import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import { type HostCallHandler, PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  Registers,
  tryAsBigGas,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { tryAsMachineId } from "./machine-instance";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;
const GAS_REG_SIZE = 112;

/**
 * Kick off (run) a PVM instance given the machine index and the destination memory (which contains gas and registers values).
 *
 * https://graypaper.fluffylabs.dev/#/85129da/363b00363b00?v=0.6.3
 */
export class Invoke implements HostCallHandler {
  index = tryAsHostCallIndex(25);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `n`
    const machineIndex = tryAsMachineId(regs.getU64(IN_OUT_REG_1));
    // `o`
    const destinationStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG_2));

    const destinationWriteable = memory.isWriteable(destinationStart, destinationStart + GAS_REG_SIZE);
    if (!destinationWriteable) {
      return PvmExecution.Panic;
    }

    // extracting gas and registers from memory
    const initialData = Bytes.zero(GAS_REG_SIZE);
    memory.loadInto(initialData.raw, destinationStart);

    const decoder = Decoder.fromBytesBlob(initialData);

    // `g`
    const gasCost = tryAsBigGas(decoder.i64());
    // `w`
    // TODO [MaSo] can it be possible to extract rest bytes w/ decoder?
    // and input it to register?
    const registers = new Registers(initialData.raw.slice(8));

    const machine = this.refine.machines.get(machineIndex);
    if (machine === undefined) {
      regs.setU64(IN_OUT_REG_1, HostCallResult.WHO);
      return;
    }

    // run the machine
    const state = await this.refine.machineInvoke(machine.code, machine.entrypoint, gasCost, registers, machine.memory);

    // save the result to the destination memory
    const resultDataBytes = Bytes.zero(GAS_REG_SIZE);
    const encoder = Encoder.create({ destination: resultDataBytes.raw });
    encoder.i64(state.gas);
    for (const register of state.registers.getAllU64()) {
      encoder.varU64(register);
    }
    memory.storeFrom(destinationStart, resultDataBytes.raw);

    // update machine
    machine.memory = state.memory;
    machine.entrypoint =
      state.result.status === Status.HOST ? tryAsU64(state.programCounter + 1n) : state.programCounter;

    this.refine.machines.set(machineIndex, machine);

    switch (state.result.status) {
      case Status.HOST:
        regs.setU64(IN_OUT_REG_1, tryAsU64(Status.HOST));
        regs.setU64(IN_OUT_REG_2, state.result.hostCallIndex);
        return;
      case Status.FAULT:
        regs.setU64(IN_OUT_REG_1, tryAsU64(Status.FAULT));
        regs.setU64(IN_OUT_REG_2, state.result.address);
        return;
      case Status.PANIC:
        regs.setU64(IN_OUT_REG_1, tryAsU64(Status.PANIC));
        return;
      case Status.HALT:
        regs.setU64(IN_OUT_REG_1, tryAsU64(Status.HALT));
        return;
      case Status.OOG:
        regs.setU64(IN_OUT_REG_1, tryAsU64(Status.OOG));
        return;
    }
  }
}
