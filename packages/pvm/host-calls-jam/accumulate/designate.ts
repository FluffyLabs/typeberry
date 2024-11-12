import { Decoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, createMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { ValidatorData } from "@typeberry/safrole";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;
const VALIDATOR_DATA_BYTES = 336;

/**
 * Designate a new set of validator keys.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2e4e012e4e01
 */
export class Designate implements HostCallHandler {
  index = 7 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `o`
    const validatorsStart = createMemoryIndex(regs.asUnsigned[IN_OUT_REG]);

    const res = new Uint8Array(VALIDATOR_DATA_BYTES * this.chainSpec.validatorsCount);
    const pageFault = memory.loadInto(res, validatorsStart);
    // page fault while reading the memory.
    if (pageFault !== null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    const d = Decoder.fromBlob(res);
    const validatorsData = d.sequenceFixLen(ValidatorData.Codec, this.chainSpec.validatorsCount);

    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    this.partialState.updateValidatorsData(validatorsData as KnownSizeArray<ValidatorData, "ValidatorsCount">);
    return Promise.resolve();
  }
}
