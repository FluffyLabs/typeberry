import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type HostCallHandler, type Memory, PvmExecution, type Registers } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsMemoryIndex, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Yield the hash.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/323002323002
 */
export class Yield implements HostCallHandler {
  index = tryAsHostCallIndex(16);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));

    const hash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(hash.raw, hashStart);
    if (pageFault !== null) {
      return PvmExecution.Panic;
    }

    this.partialState.yield(hash);
    regs.setU32(IN_OUT_REG, LegacyHostCallResult.OK);
  }
}
