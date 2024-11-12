import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Decoder, codec, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type BigGas, type Gas, type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { MEMORY_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { asOpaqueType } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

const serviceIdAndGasCodec = codec.object({
  serviceId: codec.u32.cast<ServiceId>(),
  gas: codec.u64.convert<Gas>(
    (i) => tryAsU64(i),
    (i): BigGas => asOpaqueType(i),
  ),
});

/**
 * Modify privileged services and services that auto-accumulate every block.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2e3a002e3a00
 */
export class Empower implements HostCallHandler {
  index = tryAsHostCallIndex(5);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // `m`: manager service (can change privileged services)
    const m = tryAsServiceId(regs.asUnsigned[IN_OUT_REG]);
    // `a`: manages authorization queue
    const a = tryAsServiceId(regs.asUnsigned[8]);
    // `v`: manages validator keys
    const v = tryAsServiceId(regs.asUnsigned[9]);
    const sourceStart = tryAsMemoryIndex(regs.asUnsigned[10]);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = regs.asUnsigned[11];

    // `g`: dictionary of serviceId -> gas that auto-accumulate every block
    const g = new Map<ServiceId, Gas>();
    // TODO [ToDr] Is it better to read everything in one go instead?
    const result = new Uint8Array(tryAsExactBytes(serviceIdAndGasCodec.sizeHint));
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

      const { serviceId, gas } = decoder.object(serviceIdAndGasCodec);
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
      // TODO [ToDr] we might need to wrap to the first page here!!!!
      // we should have a test for this!
      memIndex = tryAsMemoryIndex((memIndex + decoder.bytesRead()) % MEMORY_SIZE);
      previousServiceId = serviceId;
    }

    this.partialState.updatePrivilegedServices(m, a, v, g);
    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;

    return Promise.resolve();
  }
}
