import type { ServiceId } from "@typeberry/block";
import { Decoder, codec, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type BigGas, type Gas, type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { asOpaqueType } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID, clampU64ToU32, getServiceId } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

const serviceIdAndGasCodec = codec.object({
  serviceId: codec.u32.convert<ServiceId>(
    (i) => i,
    (o) => asOpaqueType(o),
  ),
  gas: codec.u64.convert<Gas>(
    (i) => tryAsU64(i),
    (o): BigGas => asOpaqueType(o),
  ),
});

/**
 * Modify privileged services and services that auto-accumulate every block.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/366a00366a00?v=0.6.6
 */
export class Bless implements HostCallHandler {
  index = tryAsHostCallIndex(5);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `m`: manager service (can change privileged services)
    const manager = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // `a`: manages authorization queue
    const authorization = getServiceId(8, regs, this.currentServiceId);
    // `v`: manages validator keys
    const validator = getServiceId(9, regs, this.currentServiceId);
    // `o`: memory offset
    const sourceStart = regs.get(10);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = regs.get(11);

    const numberOfItemsClamped = clampU64ToU32(numberOfItems);

    // `g`: dictionary of serviceId -> gas that auto-accumulate every block
    const g = new Map<ServiceId, Gas>();

    const result = new Uint8Array(tryAsExactBytes(serviceIdAndGasCodec.sizeHint) * numberOfItemsClamped);
    const memoryReadResult = memory.loadInto(result, sourceStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // Decode the items.
    // The decoder will panic if the data is not valid.
    const decoder = Decoder.fromBlob(result);
    let previousServiceId = 0;
    for (let i = 0n; i < numberOfItems; i += 1n) {
      const { serviceId, gas } = decoder.object(serviceIdAndGasCodec);
      // Since the GP does not allow non-canonical representation of encodings,
      // a set with duplicates should not be decoded correctly.
      if (g.has(serviceId)) {
        return PvmExecution.Panic;
      }
      // Verify if the items are properly sorted.
      if (previousServiceId > serviceId) {
        return PvmExecution.Panic;
      }
      g.set(serviceId, gas);
      previousServiceId = serviceId;
    }
    decoder.finish();

    if (manager === null || authorization === null || validator === null) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    this.partialState.updatePrivilegedServices(manager, authorization, validator, g);
    regs.set(IN_OUT_REG, HostCallResult.OK);
  }
}
