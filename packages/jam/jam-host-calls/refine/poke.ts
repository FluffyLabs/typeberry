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
 * Copy a piece of local memory into nested PVM instance (machine).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/359501359501?v=0.6.4
 */
export class Poke implements HostCallHandler {
  index = tryAsHostCallIndex(22);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `n`: machine index
    const machineIndex = tryAsMachineId(regs.getU64(IN_OUT_REG));
    // `s`: source memory start (nested vm)
    const sourceStart = tryAsMemoryIndex(regs.getU32(8));
    // `o`: destination memory start (local)
    const destinationStart = tryAsMemoryIndex(regs.getU32(9));
    // `z`: memory length
    const length = tryAsU32(regs.getU32(10));

    const pokeResult = await this.refine.machinePokeInto(machineIndex, sourceStart, destinationStart, length, memory);
    if (pokeResult.isOk) {
      regs.setU64(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = pokeResult.error;

    if (e === PeekPokeError.NoMachine) {
      regs.setU64(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === PeekPokeError.SourcePageFault) {
      return PvmExecution.Panic;
    }

    if (e === PeekPokeError.DestinationPageFault) {
      regs.setU64(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    assertNever(e);
  }
}
