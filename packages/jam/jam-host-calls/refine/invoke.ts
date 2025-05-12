import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder, codec, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, Registers, tryAsBigGas, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { NO_OF_REGISTERS } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { check } from "@typeberry/utils";
import { type RefineExternalities, tryAsMachineId } from "../externalities/refine-externalities";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";

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

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `n`
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG_1));
    // `o`
    const destinationStart = regs.get(IN_OUT_REG_2);

    // extracting gas and registers from memory
    const initialData = Bytes.zero(GAS_REGISTERS_SIZE);
    const readResult = memory.loadInto(initialData.raw, destinationStart);
    if (readResult.isError) {
      return PvmExecution.Panic;
    }
    // we also need to make sure that the memory is writeable, so we attempt to
    // write the data back. This is a bit redundant, but saves us from creating
    // the weird `isWriteable` method.
    const writeResult = memory.storeFrom(destinationStart, initialData.raw);
    if (writeResult.isError) {
      return PvmExecution.Panic;
    }

    const gasRegisters = Decoder.decodeObject(gasAndRegistersCodec, initialData);
    // `g`
    const gasCost = tryAsBigGas(gasRegisters.gas);
    // `w`
    const registers = Registers.fromBytes(gasRegisters.registers.raw);

    // try run the machine
    const state = await this.refine.machineInvoke(machineIndex, gasCost, registers);

    // machine not found
    if (state.isError) {
      regs.set(IN_OUT_REG_1, HostCallResult.WHO);
      return;
    }

    const machineState = state.ok;
    // save the result to the destination memory
    const resultData = Encoder.encodeObject(gasAndRegistersCodec, {
      gas: machineState.gas,
      registers: Bytes.fromBlob(machineState.registers.getAllBytesAsLittleEndian(), NO_OF_REGISTERS * 8),
    });

    // this fault does not need to be handled, because we've ensured it's
    // already writeable earlier.
    const storeResult = memory.storeFrom(destinationStart, resultData.raw);
    check(storeResult.isOk, "Memory writeability has been checked already.");

    switch (machineState.result.status) {
      case Status.HOST:
        regs.set(IN_OUT_REG_1, tryAsU64(machineState.result.status));
        regs.set(IN_OUT_REG_2, machineState.result.hostCallIndex);
        return;
      case Status.FAULT:
        regs.set(IN_OUT_REG_1, tryAsU64(machineState.result.status));
        regs.set(IN_OUT_REG_2, machineState.result.address);
        return;
      case Status.PANIC:
      case Status.HALT:
      case Status.OOG:
        regs.set(IN_OUT_REG_1, tryAsU64(machineState.result.status));
        return;
    }
    throw new Error(`Unexpected inner PVM result: ${machineState.result.status}`);
  }
}
