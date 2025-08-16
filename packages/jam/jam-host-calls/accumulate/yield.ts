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
import { Compatibility, GpVersion } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Yield accumulation trie result.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/381c02381c02?v=0.6.7
 */
export class Yield implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(16, {
      [GpVersion.V0_6_7]: 25,
    }),
  );
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
