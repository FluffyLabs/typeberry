import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Mark a preimage hash as unavailable.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/303a00303a00
 */
export class Forget implements HostCallHandler {
  index = tryAsHostCallIndex(14);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = tryAsMemoryIndex(regs.get(IN_OUT_REG));
    // `z`
    const length = tryAsU32(regs.get(8));

    const hash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(hash.raw, hashStart);
    if (pageFault !== null) {
      regs.set(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const result = this.partialState.forgetPreimage(hash, length);

    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
    } else {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
    }
  }
}
