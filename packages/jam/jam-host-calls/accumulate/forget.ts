import type { ServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { resultToString } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Mark a preimage hash as unavailable.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/382d01382d01?v=0.6.7
 */
export class Forget implements HostCallHandler {
  index = tryAsHostCallIndex(24);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = regs.get(IN_OUT_REG);
    // `z`
    const length = regs.get(8);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace`[${this.currentServiceId}] FORGET(${hash}, ${length}) <- PANIC`;
      return PvmExecution.Panic;
    }

    const result = this.partialState.forgetPreimage(hash.asOpaque(), length);
    logger.trace`[${this.currentServiceId}] FORGET(${hash}, ${length}) <- ${resultToString(result)}`;

    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
    } else {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
    }
  }
}
