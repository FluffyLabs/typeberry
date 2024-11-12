import { Decoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { ValidatorData } from "@typeberry/safrole";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;
export const VALIDATOR_DATA_BYTES = ValidatorData.Codec.sizeHint;

/**
 * Designate a new set of validator keys.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2e4e012e4e01
 */
export class Designate implements HostCallHandler {
  index = tryAsHostCallIndex(7);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `o`
    const validatorsStart = tryAsMemoryIndex(regs.asUnsigned[IN_OUT_REG]);

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
    this.partialState.updateValidatorsData(asOpaqueType(validatorsData));
    return Promise.resolve();
  }
}
