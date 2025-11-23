import type { ServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { assertNever, resultToString } from "@typeberry/utils";
import { EjectError, type PartialState } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Remove the provided service account and transfer the remaining balance to current service account.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/373b01373b01?v=0.6.7
 */
export class Eject implements HostCallHandler {
  index = tryAsHostCallIndex(21);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `d`: account to eject from (source)
    const serviceId = getServiceId(regs.get(IN_OUT_REG));
    // `o`: preimage hash start memory index
    const preimageHashStart = regs.get(8);

    // `h`: hash
    const previousCodeHash = Bytes.zero(HASH_SIZE).asOpaque<PreimageHash>();
    const memoryReadResult = memory.loadInto(previousCodeHash.raw, preimageHashStart);
    if (memoryReadResult.isError) {
      logger.trace`[${this.currentServiceId}] EJECT(${serviceId}) <- PANIC`;
      return PvmExecution.Panic;
    }

    // cannot eject self
    if (serviceId === this.currentServiceId) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      logger.trace`[${this.currentServiceId}] EJECT(${serviceId}, ${previousCodeHash}) <- WHO`;
      return;
    }

    const result = this.partialState.eject(serviceId, previousCodeHash);

    // All good!
    if (result.isOk) {
      logger.trace`[${this.currentServiceId}] EJECT(${serviceId}, ${previousCodeHash}) <- OK`;
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = result.error;

    if (e === EjectError.InvalidService) {
      logger.trace`[${this.currentServiceId}] EJECT(${serviceId}, ${previousCodeHash}) <- WHO ${resultToString(result)}`;
      regs.set(IN_OUT_REG, HostCallResult.WHO);
    } else if (e === EjectError.InvalidPreimage) {
      logger.trace`[${this.currentServiceId}] EJECT(${serviceId}, ${previousCodeHash}) <- HUH ${resultToString(result)}`;
      regs.set(IN_OUT_REG, HostCallResult.HUH);
    } else {
      assertNever(e);
    }
  }
}
