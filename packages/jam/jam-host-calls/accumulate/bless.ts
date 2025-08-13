import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Decoder, codec, tryAsExactBytes } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { tryAsPerCore } from "@typeberry/state";
import { asOpaqueType, Compatibility, GpVersion } from "@typeberry/utils";
import type { PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7;

const serviceIdAndGasCodec = codec.object({
  serviceId: codec.u32.convert<ServiceId>(
    (i) => i,
    (o) => asOpaqueType(o),
  ),
  gas: codec.u64.convert<ServiceGas>(
    (i) => tryAsU64(i),
    (o) => tryAsServiceGas(o),
  ),
});

/**
 * Modify privileged services and services that auto-accumulate every block.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/363b00363b00?v=0.6.7
 *
 * TODO [MaSo] Update handle Authorizers and check if service is manager
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/365a00365a00?v=0.6.7
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/36db0036db00?v=0.6.7
 */
export class Bless implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual(5, {
      [GpVersion.V0_6_7]: 14,
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
    // `m`: manager service (can change privileged services)
    const manager = getServiceId(regs.get(IN_OUT_REG));
    // `a`: manages authorization queue
    const authorization = getServiceId(regs.get(8));
    // `v`: manages validator keys
    const validator = getServiceId(regs.get(9));
    // `o`: memory offset
    const sourceStart = regs.get(10);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = regs.get(11);

    // `g`: array of key-value pairs serviceId -> gas that auto-accumulate every block
    const autoAccumulateEntries = new Array<[ServiceId, ServiceGas]>();

    const result = new Uint8Array(tryAsExactBytes(serviceIdAndGasCodec.sizeHint));
    const decoder = Decoder.fromBlob(result);
    let memIndex = sourceStart;
    for (let i = 0n; i < numberOfItems; i += 1n) {
      // load next item and reset the decoder
      decoder.resetTo(0);
      const memoryReadResult = memory.loadInto(result, memIndex);
      if (memoryReadResult.isError) {
        return PvmExecution.Panic;
      }

      const { serviceId, gas } = decoder.object(serviceIdAndGasCodec);

      autoAccumulateEntries.push([serviceId, gas]);

      // we allow the index to go beyond `MEMORY_SIZE` (i.e. 2**32) and have the next `loadInto` fail with page fault.
      memIndex = tryAsU64(memIndex + tryAsU64(decoder.bytesRead()));
    }

    if (manager === null || authorization === null || validator === null) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    // TODO: [MaSo] need to be updated properly to gp ^0.6.7
    this.partialState.updatePrivilegedServices(
      manager,
      tryAsPerCore(new Array(this.chainSpec.coresCount).fill(authorization), this.chainSpec),
      validator,
      autoAccumulateEntries,
    );
    regs.set(IN_OUT_REG, HostCallResult.OK);
  }
}
