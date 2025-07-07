import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { assertNever } from "@typeberry/utils";
import { type PartialState, ProvidePreimageError } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";
import { clampU64ToU32, getServiceIdOrCurrent } from "../utils.js";

const IN_OUT_REG = 7;

export class Provide implements HostCallHandler {
  index = tryAsHostCallIndex(27);
  gasCost = tryAsSmallGas(10);

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
