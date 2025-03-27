import type { ServiceGas, ServiceId } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";

/** Dictionary entry of services that auto-accumulate every block. */
export class AutoAccumulate {
  static Codec = codec.Class(AutoAccumulate, {
    service: codec.u32.asOpaque(),
    gasLimit: codec.u64.asOpaque(),
  });

  static fromCodec({ service, gasLimit }: CodecRecord<AutoAccumulate>) {
    return new AutoAccumulate(service, gasLimit);
  }

  constructor(
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
    manager: codec.u32.asOpaque(),
    authManager: codec.u32.asOpaque(),
    validatorsManager: codec.u32.asOpaque(),
    autoAccumulateServices: codec.sequenceVarLen(AutoAccumulate.Codec),
  });

  static fromCodec({
    manager,
    authManager,
    validatorsManager,
    autoAccumulateServices,
  }: CodecRecord<PrivilegedServices>) {
    return new PrivilegedServices(manager, authManager, validatorsManager, autoAccumulateServices);
  }

  private constructor(
    /**
     * The first, χm, is the index of the manager service which is
     * the service able to effect an alteration of χ from block to block.
     * https://graypaper.fluffylabs.dev/#/85129da/117201117501?v=0.6.3
     */
    readonly manager: ServiceId,
    /** Manages authorization queue. */
    readonly authManager: ServiceId,
    /** Managers validator keys. */
    readonly validatorsManager: ServiceId,
    /** Dictionary of services that auto-accumulate every block with their gas limit. */
    readonly autoAccumulateServices: AutoAccumulate[],
  ) {}
}
