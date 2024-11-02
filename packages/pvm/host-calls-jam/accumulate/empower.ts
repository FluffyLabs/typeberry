import type { ServiceId } from "@typeberry/block";
import { Decoder } from "@typeberry/codec";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, createMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "../results";
/**
 * `U`: state components mutated by the accumulation.
 * - `d`: service accounts state
 * - `i`: upcoming validator keys
 * - `q`: queue of work reports
 * - `x`: priviliges state
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/161402161402
 */
export interface AccumulationPartialState {
  /**
   * Update priviliged services and their gas.
   *
   * `m`: manager service (can change priviledged services)
   * `a`: manages authorization queue
   * `v`: manages validator keys
   * `g`: dictionary of serviceId -> gas that auto-accumulate every block
   *
   */
  updatePriviligedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, Gas>): void;
}

const IN_OUT_REG = 7;

const ENCODED_SIZE_OF_SERVICE_ID_AND_GAS = 4 + 8;

export class Empower implements HostCallHandler {
  index = 5 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = (2 ** 32 - 1) as ServiceId;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `m`: manager service (can change priviledged services)
    const m = regs.asUnsigned[IN_OUT_REG] as ServiceId;
    // `a`: manages authorization queue
    const a = regs.asUnsigned[8] as ServiceId;
    // `v`: manages validator keys
    const v = regs.asUnsigned[9] as ServiceId;
    const sourceStart = createMemoryIndex(regs.asUnsigned[10]);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = regs.asUnsigned[11];

    // `g`: dictionary of serviceId -> gas that auto-accumulate every block
    const g = new Map<ServiceId, Gas>();
    // TODO [ToDr] Is it better to read everything in one go instead?
    const result = new Uint8Array(ENCODED_SIZE_OF_SERVICE_ID_AND_GAS);
    const decoder = Decoder.fromBlob(result);
    let memIndex = sourceStart;
    let previousServiceId = 0;
    for (let i = 0; i < numberOfItems; i += 1) {
      // load next item and reset the decoder
      decoder.resetTo(0);
      const pageFault = memory.loadInto(result, memIndex);
      if (pageFault !== null) {
        regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
        return;
      }

      const serviceId = decoder.u32() as ServiceId;
      const gas = decoder.u64() as Gas;
      // Since the GP does not allow non-canonical representation of encodings,
      // a set with duplicates should not be decoded correctly.
      if (g.has(serviceId)) {
        regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
        return;
      }
      // Verify if the items are properly sorted.
      if (previousServiceId > serviceId) {
        regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
        return;
      }
      g.set(serviceId, gas);
      memIndex = createMemoryIndex(memIndex + decoder.bytesRead());
      previousServiceId = serviceId;
    }

    this.partialState.updatePriviligedServices(m, a, v, g);
    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;

    return Promise.resolve();
  }
}
