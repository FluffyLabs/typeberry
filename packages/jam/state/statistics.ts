import {
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  codecPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import { type CodecRecord, type Descriptor, codec } from "@typeberry/codec";
import { type U16, type U32, tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { type PerCore, codecPerCore } from "./common.js";

const codecVarServiceId: Descriptor<ServiceId> = codec.varU32.convert(
  (s) => tryAsU32(s),
  (i) => tryAsServiceId(i),
);

/**
 * Activity Record of a single validator.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/183701183701
 */
export class ValidatorStatistics {
  static Codec = codec.Class(ValidatorStatistics, {
    blocks: codec.u32,
    tickets: codec.u32,
    preImages: codec.u32,
    preImagesSize: codec.u32,
    guarantees: codec.u32,
    assurances: codec.u32,
  });

  static create({
    blocks,
    tickets,
    preImages,
    preImagesSize,
    guarantees,
    assurances,
  }: CodecRecord<ValidatorStatistics>) {
    return new ValidatorStatistics(blocks, tickets, preImages, preImagesSize, guarantees, assurances);
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
    return new ValidatorStatistics(zero, zero, zero, zero, zero, zero);
  }
}

const codecVarU16 = codec.varU32.convert<U16>(
  (i) => tryAsU32(i),
  (o) => tryAsU16(o),
);

/** Encode/decode unsigned gas. */
const codecVarGas: Descriptor<ServiceGas> = codec.varU64.convert(
  (g) => tryAsU64(g),
  (i) => tryAsServiceGas(i),
);

/**
 * Single core statistics.
 * Updated per block, based on incoming work reports (`w`).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/18f10318f103?v=0.6.4
 * https://github.com/gavofyork/graypaper/blob/9bffb08f3ea7b67832019176754df4fb36b9557d/text/statistics.tex#L65
 */
export class CoreStatistics {
  static Codec = codec.Class(CoreStatistics, {
    dataAvailabilityLoad: codec.varU32,
    popularity: codecVarU16,
    imports: codecVarU16,
    exports: codecVarU16,
    extrinsicSize: codec.varU32,
    extrinsicCount: codecVarU16,
    bundleSize: codec.varU32,
    gasUsed: codecVarGas,
  });

  static create(v: CodecRecord<CoreStatistics>) {
    return new CoreStatistics(
      v.dataAvailabilityLoad,
      v.popularity,
      v.imports,
      v.exports,
      v.extrinsicSize,
      v.extrinsicCount,
      v.bundleSize,
      v.gasUsed,
    );
  }

  private constructor(
    /** `d` */
    public dataAvailabilityLoad: U32,
    /** `p` */
    public popularity: U16,
    /** `i` */
    public imports: U16,
    /** `e` */
    public exports: U16,
    /** `z` */
    public extrinsicSize: U32,
    /** `x` */
    public extrinsicCount: U16,
    /** `b` */
    public bundleSize: U32,
    /** `u` */
    public gasUsed: ServiceGas,
  ) {}

  static empty() {
    const zero = tryAsU32(0);
    const zero16 = tryAsU16(0);
    const zeroGas = tryAsServiceGas(0);
    return new CoreStatistics(zero, zero16, zero16, zero16, zero, zero16, zero, zeroGas);
  }
}

/**
 * Service statistics.
 * Updated per block, based on available work reports (`W`).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/185104185104?v=0.6.4
 * https://github.com/gavofyork/graypaper/blob/9bffb08f3ea7b67832019176754df4fb36b9557d/text/statistics.tex#L77
 */
export class ServiceStatistics {
  static Codec = codec.Class(ServiceStatistics, {
    providedCount: codecVarU16,
    providedSize: codec.varU32,
    refinementCount: codec.varU32,
    refinementGasUsed: codecVarGas,
    imports: codecVarU16,
    exports: codecVarU16,
    extrinsicSize: codec.varU32,
    extrinsicCount: codecVarU16,
    accumulateCount: codec.varU32,
    accumulateGasUsed: codecVarGas,
    onTransfersCount: codec.varU32,
    onTransfersGasUsed: codecVarGas,
  });

  static create(v: CodecRecord<ServiceStatistics>) {
    return new ServiceStatistics(
      v.providedCount,
      v.providedSize,
      v.refinementCount,
      v.refinementGasUsed,
      v.imports,
      v.exports,
      v.extrinsicSize,
      v.extrinsicCount,
      v.accumulateCount,
      v.accumulateGasUsed,
      v.onTransfersCount,
      v.onTransfersGasUsed,
    );
  }

  private constructor(
    /** `p.0` */
    public providedCount: U16,
    /** `p.1` */
    public providedSize: U32,
    /** `r.0` */
    public refinementCount: U32,
    /** `r.1` */
    public refinementGasUsed: ServiceGas,
    /** `i` */
    public imports: U16,
    /** `e` */
    public exports: U16,
    /** `z` */
    public extrinsicSize: U32,
    /** `x` */
    public extrinsicCount: U16,
    /** `a.0` */
    public accumulateCount: U32,
    /** `a.1` */
    public accumulateGasUsed: ServiceGas,
    /** `t.0` */
    public onTransfersCount: U32,
    /** `t.1` */
    public onTransfersGasUsed: ServiceGas,
  ) {}

  static empty() {
    const zero = tryAsU32(0);
    const zero16 = tryAsU16(0);
    const zeroGas = tryAsServiceGas(0);
    return new ServiceStatistics(
      zero16,
      zero,
      zero,
      zeroGas,
      zero16,
      zero16,
      zero,
      zero16,
      zero,
      zeroGas,
      zero,
      zeroGas,
    );
  }
}

/** `pi`: Statistics of each validator, cores statistics and services statistics. */
export class StatisticsData {
  static Codec = codec.Class(StatisticsData, {
    current: codecPerValidator(ValidatorStatistics.Codec),
    previous: codecPerValidator(ValidatorStatistics.Codec),
    cores: codecPerCore(CoreStatistics.Codec),
    services: codec.dictionary(codecVarServiceId, ServiceStatistics.Codec, {
      sortKeys: (a, b) => a - b,
    }),
  });

  static create(v: CodecRecord<StatisticsData>) {
    return new StatisticsData(v.current, v.previous, v.cores, v.services);
  }

  private constructor(
    public readonly current: PerValidator<ValidatorStatistics>,
    public readonly previous: PerValidator<ValidatorStatistics>,
    public readonly cores: PerCore<CoreStatistics>,
    public readonly services: Map<ServiceId, ServiceStatistics>,
  ) {}
}
