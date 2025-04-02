import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { PeekPokeError, type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Peek a piece memory of a running nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/350501350501?v=0.6.4
 */
export class Peek implements HostCallHandler {
  index = tryAsHostCallIndex(21);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.getU64(IN_OUT_REG));
    // `o`: destination memory start (local)
    const destinationStart = tryAsMemoryIndex(regs.getU32(8));
    // `s`: source memory start (nested vm)
    const sourceStart = tryAsMemoryIndex(regs.getU32(9));
    // `z`: memory length
    const length = tryAsU32(regs.getU32(10));

    const isWritable = memory.isWriteable(destinationStart, length);
    if (!isWritable) {
      return PvmExecution.Panic;
    }

    const peekResult = await this.refine.machinePeekFrom(machineIndex, destinationStart, sourceStart, length, memory);
    if (peekResult.isOk) {
      regs.setU64(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = peekResult.error;

    if (e === PeekPokeError.NoMachine) {
      regs.setU64(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === PeekPokeError.PageFault) {
      regs.setU64(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    assertNever(e);
  }
}
