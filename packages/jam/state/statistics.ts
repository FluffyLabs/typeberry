import { type PerValidator, type ServiceId, codecPerValidator, tryAsServiceId } from "@typeberry/block";
import { type CodecRecord, type Descriptor, codec } from "@typeberry/codec";
import { type U16, type U32, tryAsU32 } from "@typeberry/numbers";
import { codecUnsignedGas } from "@typeberry/pvm-interpreter/gas";
import type { Gas } from "../../core/pvm-debugger-adapter";
import { type PerCore, codecPerCore } from "./common";

export const codecServiceId: Descriptor<ServiceId> = codec.u32.convert(
  (s) => tryAsU32(s),
  (i) => tryAsServiceId(i),
);
/**
 * Activity Record of a single validator.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/183701183701
 */
export class ActivityRecord {
  static Codec = codec.Class(ActivityRecord, {
    blocks: codec.u32,
    tickets: codec.u32,
    preImages: codec.u32,
    preImagesSize: codec.u32,
    guarantees: codec.u32,
    assurances: codec.u32,
  });

  static fromCodec({ blocks, tickets, preImages, preImagesSize, guarantees, assurances }: CodecRecord<ActivityRecord>) {
    return new ActivityRecord(blocks, tickets, preImages, preImagesSize, guarantees, assurances);
  }

  private constructor(
    /** The number of blocks produced by the validator. */
    public blocks: U32,
    /** The number of tickets introduced by the validator. */
    public tickets: U32,
    /** The number of preimages introduced by the validator. */
    public preImages: U32,
    /** The total number of octets across all preimages introduced by the validator. */
    public preImagesSize: U32,
    /** The number of reports guaranteed by the validator. */
    public guarantees: U32,
    /** The number of availability assurances made by the validator. */
    public assurances: U32,
  ) {}

  static empty() {
    const zero = tryAsU32(0);
    return new ActivityRecord(zero, zero, zero, zero, zero, zero);
  }
}

/**
 * Single core statistics.
 * Updated per block, based on incoming work reports (`w`).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/18f10318f103?v=0.6.4
 * https://github.com/gavofyork/graypaper/blob/main/text/statistics.tex#L65
 */
export class CoreRecord {
  static Codec = codec.Class(CoreRecord, {
    dataAvailabilityLoad: codec.u32,
    popularity: codec.u16,
    imports: codec.u16,
    extrinsicCount: codec.u16,
    extrinsicSize: codec.u32,
    exports: codec.u16,
    bandleSize: codec.u32,
    gasUsed: codecUnsignedGas,
  });

  static fromCodec(v: CodecRecord<CoreRecord>) {
    return new CoreRecord(
      v.dataAvailabilityLoad,
      v.popularity,
      v.imports,
      v.extrinsicCount,
      v.extrinsicSize,
      v.exports,
      v.bandleSize,
      v.gasUsed,
    );
  }

  private constructor(
    /** `d` */
    public readonly dataAvailabilityLoad: U32,
    /** `p` */
    public readonly popularity: U16,
    /** `i` */
    public readonly imports: U16,
    /** `e` */
    public readonly extrinsicCount: U16,
    /** `z` */
    public readonly extrinsicSize: U32,
    /** `x` */
    public readonly exports: U16,
    /** `b` */
    public readonly bandleSize: U32,
    /** `u` */
    public readonly gasUsed: Gas,
  ) {}
}

/**
 * Service statistics.
 * Updated per block, based on available work reports (`W`).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/185104185104?v=0.6.4
 * https://github.com/gavofyork/graypaper/blob/main/text/statistics.tex#L77
 */
export class ServiceRecord {
  static Codec = codec.Class(ServiceRecord, {
    providedCount: codec.u16,
    providedSize: codec.u32,
    refinementCount: codec.u32,
    refinementGasUsed: codecUnsignedGas,
    imports: codec.u16,
    extrinsicCount: codec.u16,
    extrinsicSize: codec.u32,
    exports: codec.u16,
    accumulateCount: codec.u32,
    accumulateGasUsed: codecUnsignedGas,
    onTransfersCount: codec.u32,
    onTransfersGasUsed: codecUnsignedGas,
  });

  static fromCodec(v: CodecRecord<ServiceRecord>) {
    return new ServiceRecord(
      v.providedCount,
      v.providedSize,
      v.refinementCount,
      v.refinementGasUsed,
      v.imports,
      v.extrinsicCount,
      v.extrinsicSize,
      v.exports,
      v.accumulateCount,
      v.accumulateGasUsed,
      v.onTransfersCount,
      v.onTransfersGasUsed,
    );
  }

  private constructor(
    /** `p.0` */
    public readonly providedCount: U16,
    /** `p.1` */
    public readonly providedSize: U32,
    /** `r.0` */
    public readonly refinementCount: U32,
    /** `r.1` */
    public readonly refinementGasUsed: Gas,
    /** `i` */
    public readonly imports: U16,
    /** `e` */
    public readonly extrinsicCount: U16,
    /** `z` */
    public readonly extrinsicSize: U32,
    /** `x` */
    public readonly exports: U16,
    /** `a.0` */
    public readonly accumulateCount: U32,
    /** `a.1` */
    public readonly accumulateGasUsed: Gas,
    /** `t.0` */
    public readonly onTransfersCount: U32,
    /** `t.1` */
    public readonly onTransfersGasUsed: Gas,
  ) {}
}

/** `pi`: Previous and current statistics of each validator. */
export class ActivityData {
  static Codec = codec.Class(ActivityData, {
    current: codecPerValidator(ActivityRecord.Codec),
    previous: codecPerValidator(ActivityRecord.Codec),
    cores: codecPerCore(CoreRecord.Codec),
    services: codec.dictionary(codecServiceId, ServiceRecord.Codec, {
      sortKeys: (a, b) => a - b,
    }),
  });

  static fromCodec(v: CodecRecord<ActivityData>) {
    return new ActivityData(v.current, v.previous, v.cores, v.services);
  }

  constructor(
    public current: PerValidator<ActivityRecord>,
    public previous: PerValidator<ActivityRecord>,
    public cores: PerCore<CoreRecord>,
    public services: Map<ServiceId, ServiceRecord>,
  ) {}
}
