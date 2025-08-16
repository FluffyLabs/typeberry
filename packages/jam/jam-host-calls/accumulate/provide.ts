import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { assertNever } from "@typeberry/utils";
import { type PartialState, ProvidePreimageError } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";
import { clampU64ToU32, getServiceIdOrCurrent } from "../utils.js";

const IN_OUT_REG = 7;

/**
 * Provide a preimage for a given service.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/388e02388e02?v=0.6.7
 */
export class Provide implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(27, {
      [GpVersion.V0_6_7]: 26,
    }),
  );
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(_gas: GasCounter, regs: IHostCallRegisters, memory: IHostCallMemory) {
    // `s`
    const serviceId = getServiceIdOrCurrent(IN_OUT_REG, regs, this.currentServiceId);

    // `o`
    const preimageStart = regs.get(8);
    // `z`
    const preimageLength = regs.get(9);

    const length = clampU64ToU32(preimageLength);

    // `i`
    const preimage = BytesBlob.blobFrom(new Uint8Array(length));
    const memoryReadResult = memory.loadInto(preimage.raw, preimageStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const result = this.partialState.providePreimage(serviceId, preimage);
    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = result.error;

    if (e === ProvidePreimageError.ServiceNotFound) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === ProvidePreimageError.WasNotRequested || e === ProvidePreimageError.AlreadyProvided) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    assertNever(e);
  }
}
