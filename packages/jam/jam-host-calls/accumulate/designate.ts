import { type ServiceId, tryAsPerValidator } from "@typeberry/block";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { ValidatorData } from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;
export const VALIDATOR_DATA_BYTES = tryAsExactBytes(ValidatorData.Codec.sizeHint);

/**
 * Designate a new set of validator keys.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/36b50136b501?v=0.6.7
 *
 * TODO [MaSo] Update method, needs to check privileges
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/362a02362a02?v=0.6.7
 */
export class Designate implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(7, {
      [GpVersion.V0_6_7]: 16,
    }),
  );
  gasCost = tryAsSmallGas(10);

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
    // `o`
    const validatorsStart = regs.get(IN_OUT_REG);

    const res = new Uint8Array(VALIDATOR_DATA_BYTES * this.chainSpec.validatorsCount);
    const memoryReadResult = memory.loadInto(res, validatorsStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const decoder = Decoder.fromBlob(res);
    const validatorsData = decoder.sequenceFixLen(ValidatorData.Codec, this.chainSpec.validatorsCount);

    regs.set(IN_OUT_REG, HostCallResult.OK);
    this.partialState.updateValidatorsData(tryAsPerValidator(validatorsData, this.chainSpec));
  }
}
