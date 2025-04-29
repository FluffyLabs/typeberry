import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { PeekPokeError, type RefineExternalities, tryAsMachineId } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Peek into a piece of nested machine memory.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/350501350501?v=0.6.4
 */
export class Peek implements HostCallHandler {
  index = tryAsHostCallIndex(21);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.get(IN_OUT_REG));
    // `o`: destination memory start (local)
    const destinationStart = regs.get(8);
    // `s`: source memory start (nested vm)
    const sourceStart = regs.get(9);
    // `z`: memory length
    const length = regs.get(10);

    const peekResult = await this.refine.machinePeekFrom(
      machineIndex,
      destinationStart,
      sourceStart,
      length,
      memory.getMemory(),
    );
    if (peekResult.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = peekResult.error;

    if (e === PeekPokeError.NoMachine) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === PeekPokeError.SourcePageFault) {
      return PvmExecution.Panic;
    }

    if (e === PeekPokeError.DestinationPageFault) {
      regs.set(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    assertNever(e);
  }
}
