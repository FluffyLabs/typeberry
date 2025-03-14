import { tryAsPerValidator } from "@typeberry/block";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { type PvmExecution, type Registers, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { ValidatorData } from "@typeberry/state";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;
export const VALIDATOR_DATA_BYTES = tryAsExactBytes(ValidatorData.Codec.sizeHint);

/**
 * Designate a new set of validator keys.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/31a60231a602
 */
export class Designate implements HostCallHandler {
  index = tryAsHostCallIndex(7);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // `o`
    const validatorsStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));

    const res = new Uint8Array(VALIDATOR_DATA_BYTES * this.chainSpec.validatorsCount);
    const pageFault = memory.loadInto(res, validatorsStart);
    // page fault while reading the memory.
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    const d = Decoder.fromBlob(res);
    const validatorsData = d.sequenceFixLen(ValidatorData.Codec, this.chainSpec.validatorsCount);

    regs.setU32(IN_OUT_REG, LegacyHostCallResult.OK);
    this.partialState.updateValidatorsData(tryAsPerValidator(validatorsData, this.chainSpec));
    return;
  }
}
