import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Decoder, codec, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU64, tryBigIntAsNumber } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type BigGas, type Gas, type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { MEMORY_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { asOpaqueType } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
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
 * https://graypaper.fluffylabs.dev/#/579bd12/317d01317d01
 */
export class Bless implements HostCallHandler {
  index = tryAsHostCallIndex(5);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `m`: manager service (can change privileged services)
    const m = tryAsServiceId(tryBigIntAsNumber(regs.get(IN_OUT_REG)));
    // `a`: manages authorization queue
    const a = tryAsServiceId(tryBigIntAsNumber(regs.get(8)));
    // `v`: manages validator keys
    const v = tryAsServiceId(tryBigIntAsNumber(regs.get(9)));
    // `o`: memory offset
    const sourceStart = regs.get(10);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = tryBigIntAsNumber(regs.get(11));

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
      const memoryReadResult = memory.loadInto(result, memIndex);
      // error while reading the memory.
      if (memoryReadResult.isError) {
        return PvmExecution.Panic;
      }

      const { serviceId, gas } = decoder.object(serviceIdAndGasCodec);
      // Since the GP does not allow non-canonical representation of encodings,
      // a set with duplicates should not be decoded correctly.
      if (g.has(serviceId)) {
        regs.set(IN_OUT_REG, HostCallResult.OOB);
        return;
      }
      // Verify if the items are properly sorted.
      if (previousServiceId > serviceId) {
        regs.set(IN_OUT_REG, HostCallResult.OOB);
        return;
      }
      g.set(serviceId, gas);
      // TODO [ToDr] we might need to wrap to the first page here!!!!
      // we should have a test for this!
      memIndex = tryAsU64((memIndex + tryAsU64(decoder.bytesRead())) % tryAsU64(MEMORY_SIZE));
      previousServiceId = serviceId;
    }

    this.partialState.updatePrivilegedServices(m, a, v, g);
    regs.set(IN_OUT_REG, HostCallResult.OK);

    return;
  }
}
