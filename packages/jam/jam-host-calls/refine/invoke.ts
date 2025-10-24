import { Bytes } from "@typeberry/bytes";
import { codec, Decoder, Encoder, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  HostCallRegisters,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import {
  type IGasCounter,
  NO_OF_REGISTERS,
  REGISTER_BYTE_SIZE,
  Status,
  tryAsBigGas,
  tryAsSmallGas,
} from "@typeberry/pvm-interface";
import { check, resultToString } from "@typeberry/utils";
import { type RefineExternalities, tryAsMachineId } from "../externalities/refine-externalities.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { CURRENT_SERVICE_ID } from "../utils.js";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;
const gasAndRegistersCodec = codec.object({
  gas: codec.i64,
  registers: codec.bytes(NO_OF_REGISTERS * REGISTER_BYTE_SIZE),
});
const GAS_REGISTERS_SIZE = tryAsExactBytes(gasAndRegistersCodec.sizeHint);

/**
 * Kick off (run) a PVM instance given the machine index and the destination memory (which contains gas and registers values).
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/354301354301?v=0.6.7
 */
export class Invoke implements HostCallHandler {
  index = tryAsHostCallIndex(12);
  basicGasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;
  tracedRegisters = traceRegisters(IN_OUT_REG_1, IN_OUT_REG_2);

  constructor(private readonly refine: RefineExternalities) {}

  async execute(
    _gas: IGasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG_1));
    // `o`: destination memory start (local)
    const destinationStart = regs.get(IN_OUT_REG_2);

    // extracting gas and registers from memory
    const initialData = Bytes.zero(GAS_REGISTERS_SIZE);
    const readResult = memory.loadInto(initialData.raw, destinationStart);
    if (readResult.isError) {
      logger.trace`INVOKE(${machineIndex}) <- PANIC (read)`;
      return PvmExecution.Panic;
    }

    // we also need to make sure that the memory is writeable, so we attempt to
    // write the data back. This is a bit redundant, but saves us from creating
    // the weird `isWriteable` method.
    const writeResult = memory.storeFrom(destinationStart, initialData.raw);
    if (writeResult.isError) {
      logger.trace`INVOKE(${machineIndex}) <- PANIC (write)`;
      return PvmExecution.Panic;
    }

    const gasRegisters = Decoder.decodeObject(gasAndRegistersCodec, initialData);
    // `g`
    const gasCost = tryAsBigGas(gasRegisters.gas);
    // `w`
    const registers = new HostCallRegisters(gasRegisters.registers.raw);

    // try run the machine
    const state = await this.refine.machineInvoke(machineIndex, gasCost, registers);
    logger.trace`INVOKE(${machineIndex}, ${gasCost}, ${registers}) <- ${resultToString(state)}`;

    // machine not found
    if (state.isError) {
      regs.set(IN_OUT_REG_1, HostCallResult.WHO);
      return;
    }

    const machineState = state.ok;
    // save the result to the destination memory
    const resultData = Encoder.encodeObject(gasAndRegistersCodec, {
      gas: machineState.gas,
      registers: Bytes.fromBlob(machineState.registers.getEncoded(), NO_OF_REGISTERS * 8),
    });

    // this fault does not need to be handled, because we've ensured it's
    // already writeable earlier.
    const storeResult = memory.storeFrom(destinationStart, resultData.raw);
    check`${storeResult.isOk} Memory writeability has been checked already.`;

    const returnState = machineState.result;

    if (returnState.status === Status.HOST) {
      regs.set(IN_OUT_REG_1, tryAsU64(returnState.status));
      regs.set(IN_OUT_REG_2, returnState.hostCallIndex);
      return;
    }

    if (returnState.status === Status.FAULT) {
      regs.set(IN_OUT_REG_1, tryAsU64(returnState.status));
      regs.set(IN_OUT_REG_2, returnState.address);
      return;
    }

    if ([Status.PANIC, Status.HALT, Status.OOG].includes(returnState.status)) {
      regs.set(IN_OUT_REG_1, tryAsU64(returnState.status));
      return;
    }

    const statusName = Status[returnState.status] !== undefined ? Status[returnState.status] : "Unknown";
    throw new Error(`Unexpected inner PVM result: ${returnState.status} (${statusName})`);
  }
}
