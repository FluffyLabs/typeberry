import { tryAsServiceId, type ServiceGas, type ServiceId } from "@typeberry/block";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { codecPerCore, type PerCore } from "./common.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { ignoreValueWithDefault } from "./service.js";

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
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/114402114402?v=0.7.2
 */
export class PrivilegedServices {
  /** https://graypaper.fluffylabs.dev/#/ab2cdbd/3bbd023bcb02?v=0.7.2 */
  static Codec = codec.Class(PrivilegedServices, {
    manager: codec.u32.asOpaque<ServiceId>(),
    assigners: codecPerCore(codec.u32.asOpaque<ServiceId>()),
    delegator: codec.u32.asOpaque<ServiceId>(),
    registrar: Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? codec.u32.asOpaque<ServiceId>() : ignoreValueWithDefault(tryAsServiceId(0)),
    autoAccumulateServices: readonlyArray(codec.sequenceVarLen(AutoAccumulate.Codec)),
  });

  static create(a: CodecRecord<PrivilegedServices>) {
    return new PrivilegedServices(a.manager, a.delegator, a.registrar, a.assigners, a.autoAccumulateServices);
  }

  private constructor(
    /**
     * `χ_M`: Manages alteration of χ from block to block,
     * as well as bestow services with storage deposit credits.
     * https://graypaper.fluffylabs.dev/#/ab2cdbd/111502111902?v=0.7.2
     */
    readonly manager: ServiceId,
    /** `χ_V`: Managers validator keys. */
    readonly delegator: ServiceId,
    /**
     * `χ_R`: Manages the creation of services in protected range.
     *
     * https://graypaper.fluffylabs.dev/#/ab2cdbd/111b02111d02?v=0.7.2
     */
    readonly registrar: ServiceId,
    /** `χ_A`: Manages authorization queue one for each core. */
    readonly assigners: PerCore<ServiceId>,
    /** `χ_Z`: Dictionary of services that auto-accumulate every block with their gas limit. */
    readonly autoAccumulateServices: readonly AutoAccumulate[],
  ) {}
}
