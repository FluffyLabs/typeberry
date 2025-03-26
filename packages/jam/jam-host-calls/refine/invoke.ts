import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder, codec, tryAsExactBytes } from "@typeberry/codec";
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
import { NO_OF_REGISTERS } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { tryAsMachineId } from "./machine-instance";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;
const gasAndRegistersCodec = codec.object({
  gas: codec.i64,
  registers: codec.bytes(NO_OF_REGISTERS * 8),
});
const GAS_REGISTERS_SIZE = tryAsExactBytes(gasAndRegistersCodec.sizeHint);

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

    const destinationWriteable = memory.isWriteable(destinationStart, destinationStart + GAS_REGISTERS_SIZE);
    if (!destinationWriteable) {
      return PvmExecution.Panic;
    }

    // extracting gas and registers from memory
    const initialData = Bytes.zero(GAS_REGISTERS_SIZE);
    memory.loadInto(initialData.raw, destinationStart);

    const gasRegisters = Decoder.decodeObject(gasAndRegistersCodec, initialData);
    // `g`
    const gasCost = tryAsBigGas(gasRegisters.gas);
    // `w`
    const registers = Registers.fromBytes(gasRegisters.registers.raw);

    // try run the machine
    const state = await this.refine.machineInvoke(machineIndex, gasCost, registers);

    // machine not found
    if (state === undefined) {
      regs.setU64(IN_OUT_REG_1, HostCallResult.WHO);
      return;
    }

    // save the result to the destination memory
    const resultDataBytes = Encoder.encodeObject(gasAndRegistersCodec, {
      gas: state.gas,
      registers: Bytes.fromBlob(state.registers.getAllBytesAsLittleEndian(), NO_OF_REGISTERS * 8),
    });

    memory.storeFrom(destinationStart, resultDataBytes.raw);

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
      default:
        throw new Error(`Unexpected inner PVM result: ${state.result.status}`);
    }
  }
}
