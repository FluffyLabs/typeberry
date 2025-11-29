import { type ServiceId, tryAsCoreIndex } from "@typeberry/block";
import { codec, Decoder } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/state";
import { assertNever, safeAllocUint8Array } from "@typeberry/utils";
import { type PartialState, UpdatePrivilegesError } from "../externalities/partial-state.js";
import { HostCallResult } from "../general/results.js";
import { logger } from "../logger.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Assign new fixed-length authorization queue to some core and authorize a service for this core.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/360d01360d01?v=0.6.7
 */
export class Assign implements HostCallHandler {
  index = tryAsHostCallIndex(15);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // c
    const maybeCoreIndex = regs.get(IN_OUT_REG);
    // o
    const authorizationQueueStart = regs.get(8);
    // a
    const assigners = getServiceId(regs.get(9));

    const res = safeAllocUint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const memoryReadResult = memory.loadInto(res, authorizationQueueStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace`[${this.currentServiceId}] ASSIGN() <- PANIC`;
      return PvmExecution.Panic;
    }

    if (maybeCoreIndex >= this.chainSpec.coresCount) {
      regs.set(IN_OUT_REG, HostCallResult.CORE);
      return;
    }
    // NOTE: Here we know the core index is valid
    const coreIndex = tryAsCoreIndex(Number(maybeCoreIndex));

    const decoder = Decoder.fromBlob(res);
    const authQueue = decoder.sequenceFixLen(codec.bytes(HASH_SIZE).asOpaque(), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    const result = this.partialState.updateAuthorizationQueue(coreIndex, fixedSizeAuthQueue, assigners);
    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      logger.trace`[${this.currentServiceId}] ASSIGN(${coreIndex}, ${fixedSizeAuthQueue}) <- OK`;
      return;
    }

    const e = result.error;

    if (e === UpdatePrivilegesError.UnprivilegedService) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      logger.trace`[${this.currentServiceId}] ASSIGN(${coreIndex}, ${fixedSizeAuthQueue}) <- HUH`;
      return;
    }

    if (e === UpdatePrivilegesError.InvalidServiceId) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      logger.trace`[${this.currentServiceId}] ASSIGN(${coreIndex}, ${fixedSizeAuthQueue}) <- HUH`;
      return;
    }

    assertNever(e);
  }
}
