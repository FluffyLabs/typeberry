import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
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
import { PeekError, type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Peek a piece memory of a running nested machine.
 *
 * https://graypaper.fluffylabs.dev/#/911af30/338801338801
 */
export class Peek implements HostCallHandler {
  index = tryAsHostCallIndex(19);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.asUnsigned[IN_OUT_REG]);
    // `o`: destination memory start (local)
    const destinationStart = tryAsMemoryIndex(regs.asUnsigned[8]);
    // `s`: source memory start (nested vm)
    const sourceStart = tryAsMemoryIndex(regs.asUnsigned[9]);
    // `z`: memory length
    const length = tryAsU32(regs.asUnsigned[10]);

    const peekResult = await this.refine.machinePeek(machineIndex, destinationStart, sourceStart, length, memory);
    if (peekResult.isOk) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
      return;
    }

    const e = peekResult.error;

    if (e === PeekError.NoMachine) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.WHO;
      return;
    }

    if (e === PeekError.PageFault) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    assertNever(e);
  }
}
