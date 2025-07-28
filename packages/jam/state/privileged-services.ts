import type { ServiceGas, ServiceId } from "@typeberry/block";
import { codecWithContext } from "@typeberry/block/codec.js";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { type PerCore, codecPerCore, tryAsPerCore } from "./common.js";

/** Dictionary entry of services that auto-accumulate every block. */
export class AutoAccumulate {
  static Codec = codec.Class(AutoAccumulate, {
    service: codec.u32.asOpaque<ServiceId>(),
    gasLimit: codec.u64.asOpaque<ServiceGas>(),
  });

  static create({ service, gasLimit }: CodecRecord<AutoAccumulate>) {
    return new AutoAccumulate(service, gasLimit);
  }

  private constructor(
    /** Service id that auto-accumulates. */
    readonly service: ServiceId,
    /** Gas limit for auto-accumulation. */
    readonly gasLimit: ServiceGas,
  ) {}
}

/**
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/11da0111da01?v=0.6.7
 */
export class PrivilegedServices {
  static Codec = codec.Class(PrivilegedServices, {
    manager: codec.u32.asOpaque<ServiceId>(),
    authManager: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? codecPerCore(codec.u32.asOpaque<ServiceId>())
      : codecWithContext((ctx) =>
          codec.u32.asOpaque<ServiceId>().convert(
            // NOTE: [MaSo] In a compatibility mode we are always updating all entries
            // (all the entries are the same)
            // so it doesn't matter which one we take here.
            (perCore: PerCore<ServiceId>) => perCore[0],
            (serviceId: ServiceId) => {
              const array = new Array(ctx.coresCount).fill(serviceId);
              return tryAsPerCore(array, ctx);
            },
          ),
        ),
    validatorsManager: codec.u32.asOpaque<ServiceId>(),
    autoAccumulateServices: readonlyArray(codec.sequenceVarLen(AutoAccumulate.Codec)),
  });

  static create({ manager, authManager, validatorsManager, autoAccumulateServices }: CodecRecord<PrivilegedServices>) {
    return new PrivilegedServices(manager, authManager, validatorsManager, autoAccumulateServices);
  }

  private constructor(
    /**
     * `chi_m`: The first, χm, is the index of the manager service which is
     * the service able to effect an alteration of χ from block to block,
     * as well as bestow services with storage deposit credits.
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/11a40111a801?v=0.6.7
     */
    readonly manager: ServiceId,
    /** `chi_a`: Manages authorization queue one for each core. */
    readonly authManager: PerCore<ServiceId>,
    /** `chi_v`: Managers validator keys. */
    readonly validatorsManager: ServiceId,
    /** `chi_g`: Dictionary of services that auto-accumulate every block with their gas limit. */
    readonly autoAccumulateServices: readonly AutoAccumulate[],
  ) {}
}
