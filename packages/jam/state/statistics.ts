import {
  codecPerValidator,
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import { type CodecRecord, codec, type DescribedBy, type Descriptor } from "@typeberry/codec";
import { tryAsU16, tryAsU32, tryAsU64, type U16, type U32 } from "@typeberry/numbers";
import { Compatibility, GpVersion, TestSuite } from "@typeberry/utils";
import { codecPerCore, type PerCore } from "./common.js";
import { ignoreValueWithDefault } from "./service.js";

const codecServiceId: Descriptor<ServiceId> = Compatibility.isSuite(TestSuite.W3F_DAVXY)
  ? codec.u32.asOpaque<ServiceId>()
  : codec.varU32.convert(
      (s) => tryAsU32(s),
      (i) => tryAsServiceId(i),
    );

/**
 * Activity Record of a single validator.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/195c00195c00?v=0.7.2
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
    /** `b`: The number of blocks produced by the validator. */
    public blocks: U32,
    /** `t`: The number of tickets introduced by the validator. */
    public tickets: U32,
    /** `p`: The number of preimages introduced by the validator. */
    public preImages: U32,
    /** `d`: The total number of octets across all preimages introduced by the validator. */
    public preImagesSize: U32,
    /** `g`: The number of reports guaranteed by the validator. */
    public guarantees: U32,
    /** `a`: The number of availability assurances made by the validator. */
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
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/197902197902?v=0.7.2
 * https://github.com/gavofyork/graypaper/blob/9bffb08f3ea7b67832019176754df4fb36b9557d/text/statistics.tex#L65
 */
export class CoreStatistics {
  static Codec = codec.Class(CoreStatistics, {
    dataAvailabilityLoad: codec.varU32,
    popularity: codecVarU16,
    imports: codecVarU16,
    extrinsicCount: codecVarU16,
    extrinsicSize: codec.varU32,
    exports: codecVarU16,
    bundleSize: codec.varU32,
    gasUsed: codecVarGas,
  });

  static create(v: CodecRecord<CoreStatistics>) {
    return new CoreStatistics(
      v.dataAvailabilityLoad,
      v.popularity,
      v.imports,
      v.extrinsicCount,
      v.extrinsicSize,
      v.exports,
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
    /** `x` */
    public extrinsicCount: U16,
    /** `z` */
    public extrinsicSize: U32,
    /** `e` */
    public exports: U16,
    /** `l` */
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
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/19e20219e202?v=0.7.2
 */
export class ServiceStatistics {
  static Codec = Compatibility.selectIfGreaterOrEqual({
    fallback: codec.Class(ServiceStatistics, {
      providedCount: codecVarU16,
      providedSize: codec.varU32,
      refinementCount: codec.varU32,
      refinementGasUsed: codecVarGas,
      imports: codecVarU16,
      extrinsicCount: codecVarU16,
      extrinsicSize: codec.varU32,
      exports: codecVarU16,
      accumulateCount: codec.varU32,
      accumulateGasUsed: codecVarGas,
      onTransfersCount: codec.varU32,
      onTransfersGasUsed: codecVarGas,
    }),
    versions: {
      [GpVersion.V0_7_1]: codec.Class(ServiceStatistics, {
        providedCount: codecVarU16,
        providedSize: codec.varU32,
        refinementCount: codec.varU32,
        refinementGasUsed: codecVarGas,
        imports: codecVarU16,
        extrinsicCount: codecVarU16,
        extrinsicSize: codec.varU32,
        exports: codecVarU16,
        accumulateCount: codec.varU32,
        accumulateGasUsed: codecVarGas,
        onTransfersCount: ignoreValueWithDefault(tryAsU32(0)),
        onTransfersGasUsed: ignoreValueWithDefault(tryAsServiceGas(0)),
      }),
    },
  });

  static create(v: CodecRecord<ServiceStatistics>) {
    return new ServiceStatistics(
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
    public providedCount: U16,
    /** `p.1` */
    public providedSize: U32,
    /** `r.0` */
    public refinementCount: U32,
    /** `r.1` */
    public refinementGasUsed: ServiceGas,
    /** `i` */
    public imports: U16,
    /** `x` */
    public extrinsicCount: U16,
    /** `z` */
    public extrinsicSize: U32,
    /** `e` */
    public exports: U16,
    /** `a.0` */
    public accumulateCount: U32,
    /** `a.1` */
    public accumulateGasUsed: ServiceGas,
    /** `t.0` @deprecated since 0.7.1 */
    public onTransfersCount: U32,
    /** `t.1` @deprecated since 0.7.1 */
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
    services: codec.dictionary(codecServiceId, ServiceStatistics.Codec, {
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

export type StatisticsDataView = DescribedBy<typeof StatisticsData.Codec.View>;
