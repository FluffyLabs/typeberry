import type { ServiceGas, ServiceId } from "@typeberry/block";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { type PerCore, codecPerCore } from "./common.js";

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
 * https://graypaper.fluffylabs.dev/#/85129da/11a20111a201?v=0.6.3
 */
export class PrivilegedServices {
  static Codec = codec.Class(PrivilegedServices, {
    manager: codec.u32.asOpaque<ServiceId>(),
    authManager: codecPerCore(codec.u32.asOpaque<ServiceId>()),
    validatorsManager: codec.u32.asOpaque<ServiceId>(),
    autoAccumulateServices: readonlyArray(codec.sequenceVarLen(AutoAccumulate.Codec)),
  });

  static create({ manager, authManager, validatorsManager, autoAccumulateServices }: CodecRecord<PrivilegedServices>) {
    return new PrivilegedServices(manager, authManager, validatorsManager, autoAccumulateServices);
  }

  private constructor(
    /**
     * `chi_m`: The first, χm, is the index of the manager service which is
     * the service able to effect an alteration of χ from block to block.
     * https://graypaper.fluffylabs.dev/#/85129da/117201117501?v=0.6.3
     */
    readonly manager: ServiceId,
    /** `chi_a`: Manages authorization queue. */
    readonly authManager: PerCore<ServiceId>,
    /** `chi_v`: Managers validator keys. */
    readonly validatorsManager: ServiceId,
    /** `chi_g`: Dictionary of services that auto-accumulate every block with their gas limit. */
    readonly autoAccumulateServices: readonly AutoAccumulate[],
  ) {}
}
