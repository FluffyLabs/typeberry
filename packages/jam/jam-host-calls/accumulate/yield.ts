import type { ServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
} from "@typeberry/pvm-host-calls";
import { traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import type { PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Yield accumulation trie result.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/331c02331c02?v=0.6.3
 * https://graypaper.fluffylabs.dev/#/85129da/3f98003f9b00?v=0.6.3
 */
export class Yield implements HostCallHandler {
  index = tryAsHostCallIndex(16);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = regs.get(IN_OUT_REG);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    this.partialState.yield(hash);
    regs.set(IN_OUT_REG, HostCallResult.OK);
  }
}
