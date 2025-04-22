import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7; // `o`
const GAS_REG = 8; // `g`
const ALLOWANCE_REG = 9; // `m`

/**
 * Upgrade the code of the service.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/324401324401
 */
export class Upgrade implements HostCallHandler {
  index = tryAsHostCallIndex(10);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `o`
    const codeHashStart = regs.get(IN_OUT_REG);
    // `g`
    const gas = regs.get(GAS_REG);
    // `m`
    const allowance = regs.get(ALLOWANCE_REG);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(codeHash.raw, codeHashStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    this.partialState.upgradeService(codeHash.asOpaque(), gas, allowance);

    regs.set(IN_OUT_REG, HostCallResult.OK);
    return;
  }
}
