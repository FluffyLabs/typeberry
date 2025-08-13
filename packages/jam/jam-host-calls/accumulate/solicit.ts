import type { ServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion, assertNever } from "@typeberry/utils";
import { type PartialState, RequestPreimageError } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Request a preimage to be available.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/383b00383b00?v=0.6.7
 */
export class Solicit implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(14, {
      [GpVersion.V0_6_7]: 23,
    }),
  );
  gasCost = tryAsSmallGas(10);

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
    // `z`
    const length = regs.get(8);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const result = this.partialState.requestPreimage(hash.asOpaque(), length);
    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = result.error;

    if (e === RequestPreimageError.AlreadyAvailable || e === RequestPreimageError.AlreadyRequested) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    if (e === RequestPreimageError.InsufficientFunds) {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
      return;
    }

    assertNever(e);
  }
}
