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
import { Compatibility, GpVersion, assertNever } from "@typeberry/utils";
import { type PartialState, UpdatePrivilegesError } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Assign new fixed-length authorization queue to some core and authorize a service for this core.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/360d01360d01?v=0.6.7
 */
export class Assign implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual({
      fallback: 6,
      versions: {
        [GpVersion.V0_6_7]: 15,
      },
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
    // c
    const maybeCoreIndex = regs.get(IN_OUT_REG);
    // o
    const authorizationQueueStart = regs.get(8);
    // a
    const authManager = getServiceId(regs.get(9));

    const res = new Uint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const memoryReadResult = memory.loadInto(res, authorizationQueueStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    if (maybeCoreIndex >= this.chainSpec.coresCount) {
      regs.set(IN_OUT_REG, HostCallResult.CORE);
      return;
    }
    // NOTE: Here we know the core index is valid
    const coreIndex = tryAsCoreIndex(Number(maybeCoreIndex));

    const decoder = Decoder.fromBlob(res);
    const authQueue = decoder.sequenceFixLen(codec.bytes(HASH_SIZE), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      const result = this.partialState.updateAuthorizationQueue(coreIndex, fixedSizeAuthQueue, authManager);
      if (result.isOk) {
        regs.set(IN_OUT_REG, HostCallResult.OK);
        return;
      }

      const e = result.error;

      if (e === UpdatePrivilegesError.UnprivilegedService) {
        regs.set(IN_OUT_REG, HostCallResult.HUH);
        return;
      }

      if (e === UpdatePrivilegesError.InvalidServiceId) {
        regs.set(IN_OUT_REG, HostCallResult.WHO);
        return;
      }

      assertNever(e);
    } else {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      void this.partialState.updateAuthorizationQueue(coreIndex, fixedSizeAuthQueue, authManager);
    }
  }
}
