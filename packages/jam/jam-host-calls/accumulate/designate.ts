import { tryAsPerValidator } from "@typeberry/block";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { ValidatorData } from "@typeberry/state";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;
export const VALIDATOR_DATA_BYTES = tryAsExactBytes(ValidatorData.Codec.sizeHint);

/**
 * Designate a new set of validator keys.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/369501369501?v=0.6.6
 */
export class Designate implements HostCallHandler {
  index = tryAsHostCallIndex(7);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `o`
    const validatorsStart = regs.get(IN_OUT_REG);

    // TODO [MaSo] this should be a constant
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
