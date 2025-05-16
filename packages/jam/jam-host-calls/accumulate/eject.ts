import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID, getServiceId } from "../utils";
import { type AccumulationPartialState, EjectError } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Remove the provided service account and transfer the remaining balance to current service account.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/373b01373b01?v=0.6.6
 */
export class Eject implements HostCallHandler {
  index = tryAsHostCallIndex(12);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `d`: account to eject from (source)
    const serviceId = getServiceId(regs.get(IN_OUT_REG));
    // `o`: preimage hash start memory index
    const preimageHashStart = regs.get(8);

    // `h`: hash
    const preimageHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(preimageHash.raw, preimageHashStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // cannot eject self
    if (serviceId === this.currentServiceId) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    const result = await this.partialState.eject(serviceId, preimageHash);

    // All good!
    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = result.error;

    if (e === EjectError.InvalidService) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
    } else if (e === EjectError.InvalidPreimage) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
    } else {
      assertNever(e);
    }
  }
}
