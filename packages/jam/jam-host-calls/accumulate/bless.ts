import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Decoder, codec, tryAsExactBytes } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { tryAsPerCore } from "@typeberry/state";
import { asOpaqueType, assertNever } from "@typeberry/utils";
import { type PartialState, UpdatePrivilegesError } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
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
 */
export class Bless implements HostCallHandler {
  index = tryAsHostCallIndex(14);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11);

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
    // NOTE It can be either ServiceId (pre GP 067) or memory index (GP ^067)
    const authorization = regs.get(8);
    // `v`: manages validator keys
    const validator = getServiceId(regs.get(9));
    // `o`: memory offset
    const sourceStart = regs.get(10);
    // `n`: number of items in the auto-accumulate dictionary
    const numberOfItems = regs.get(11);

    /*
     * `z`: array of key-value pairs serviceId -> gas that auto-accumulate every block
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/368100368100?v=0.6.7
     */
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
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/367200367200?v=0.6.7
    const res = new Uint8Array(tryAsExactBytes(codec.u32.sizeHint) * this.chainSpec.coresCount);
    const authorizersDecoder = Decoder.fromBlob(res);
    const memoryReadResult = memory.loadInto(res, authorization);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const authorizers = tryAsPerCore(
      authorizersDecoder.sequenceFixLen(codec.u32.asOpaque<ServiceId>(), this.chainSpec.coresCount),
      this.chainSpec,
    );

    const updateResult = this.partialState.updatePrivilegedServices(
      manager,
      authorizers,
      validator,
      autoAccumulateEntries,
    );
    logger.trace(`BLESS(${manager}, ${authorizers}, ${validator}, ${autoAccumulateEntries})`);

    if (updateResult.isOk) {
      logger.trace("BLESS result: OK");
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = updateResult.error;

    if (e === UpdatePrivilegesError.UnprivilegedService) {
      logger.trace("BLESS result: HUH");
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    if (e === UpdatePrivilegesError.InvalidServiceId) {
      logger.trace("BLESS result: WHO");
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    assertNever(e);
  }
}
