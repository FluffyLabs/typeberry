import { type ServiceId, tryAsCoreIndex } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import { Decoder, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Assign new fixed-length authorization queue to some core.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/360d01360d01?v=0.6.7
 *
 * TODO [MaSo] Update assign, check privileges
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/369101369101?v=0.6.7
 */
export class Assign implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(6, {
      [GpVersion.V0_6_7]: 15,
    }),
  );
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    const coreIndex = regs.get(IN_OUT_REG);
    // o
    const authorizationQueueStart = regs.get(8);

    const res = new Uint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const memoryReadResult = memory.loadInto(res, authorizationQueueStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // the core is unknown
    if (coreIndex >= this.chainSpec.coresCount) {
      regs.set(IN_OUT_REG, HostCallResult.CORE);
      return;
    }

    const decoder = Decoder.fromBlob(res);
    const authQueue = decoder.sequenceFixLen(codec.bytes(HASH_SIZE), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    regs.set(IN_OUT_REG, HostCallResult.OK);
    // NOTE [MaSo] its safe to cast to Number because we know that the coreIndex is less than cores count = 341
    this.partialState.updateAuthorizationQueue(tryAsCoreIndex(Number(coreIndex)), fixedSizeAuthQueue);
  }
}
