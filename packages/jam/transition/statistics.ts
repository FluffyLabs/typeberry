import {
  type CoreIndex,
  type Extrinsic,
  type ServiceId,
  type TimeSlot,
  type ValidatorIndex,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import type { AvailabilityAssurance } from "@typeberry/block/assurances";
import { W_G } from "@typeberry/block/gp-constants";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { WorkReport } from "@typeberry/block/work-report";
import type { WorkResult } from "@typeberry/block/work-result";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import type { State } from "@typeberry/state";
import { CoreStatistics, ServiceStatistics, ValidatorStatistics } from "@typeberry/state";
import { check } from "@typeberry/utils";

export type Input = {
  slot: TimeSlot;
  authorIndex: ValidatorIndex;
  extrinsic: Extrinsic;
  availableReports: WorkReport[];
};

/** https://graypaper.fluffylabs.dev/#/68eaa1f/18f60118f601?v=0.6.4 */
export type StatisticsState = Pick<State, "timeslot"> & {
  statistics: State["statistics"];
  /**
   * `κ' kappa_prime`: Posterior active validators
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/187103187103?v=0.6.4
   */
  readonly currentValidatorData: State["currentValidatorData"];
};

export class Statistics {
  constructor(
    private readonly chainSpec: ChainSpec,
    public readonly state: StatisticsState,
  ) {}

  private getStatistics(slot: TimeSlot) {
    /** https://graypaper.fluffylabs.dev/#/68eaa1f/186402186402?v=0.6.4 */
    const currentEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const nextEpoch = Math.floor(slot / this.chainSpec.epochLength);

    /** e === e' */
    if (currentEpoch === nextEpoch) {
      return this.state.statistics;
    }

    /** e !== e' */
    const current = Array(this.chainSpec.validatorsCount)
      .fill(0)
      .map(() => ValidatorStatistics.empty());

    return {
      ...this.state.statistics,
      current: tryAsPerValidator(current, this.chainSpec),
      previous: this.state.statistics.current,
    };
  }

  /**
   * Calculate core statistics
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/19fc0019fc00?v=0.6.4
   */
  public calculateCoreStatistics(
    c: CoreIndex,
    workReports: WorkReport[],
    availableReports: WorkReport[],
    availabilityAssurances: AvailabilityAssurance[],
  ) {
    const { imports, extrinsicCount, extrinsicSize, exports, gasUsed, bundleSize } = this.calculateRefineScoreCore(workReports);
    const dataAvailabilityLoad = this.calculateDictionaryScoreCore(availableReports);
    const popularity = availabilityAssurances.reduce((sum, assurance) => {
      if (assurance === undefined || assurance.bitfield === undefined) {
        return sum;
      }
      return sum + (assurance.bitfield.isSet(c) ? 1 : 0);
    }, 0);

    return {
      imports,
      extrinsicCount,
      extrinsicSize,
      exports,
      gasUsed,
      bundleSize,
      dataAvailabilityLoad,
      popularity,
    };
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/192d01192d01?v=0.6.4 */
  private calculateRefineScoreCore(workReports: WorkReport[]) {
    const score = {
      imports: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exports: 0,
      gasUsed: 0n,
      bundleSize: 0,
    };

    for (const workReport of workReports) {
      for (const workResult of workReport.results.map((r) => r)) {
        score.imports += workResult.load.importedSegments;
        score.extrinsicCount += workResult.load.extrinsicCount;
        score.extrinsicSize += workResult.load.extrinsicSize;
        score.exports += workResult.load.exportedSegments;
        score.gasUsed += workResult.load.gasUsed;
      }
      score.bundleSize += workReport.workPackageSpec.length;
    }

    return score;
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/195601195601?v=0.6.4 */
  private calculateDictionaryScoreCore(availableWorkReports: WorkReport[]) {
    let sum = 0;

    for (const r of availableWorkReports) {
      const workPackageLength = r.workPackageSpec.length;
      const workPackageSegment = Math.ceil((r.workPackageSpec.exportsCount * 65) / 64);
      sum += workPackageLength + W_G * workPackageSegment;
    }

    return sum;
  }


  /**
   * Calculate service statistics
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/199002199002?v=0.6.4
   */
  public calculateServiceStatistics(s: ServiceId, workReports: WorkReport[], preimages: PreimagesExtrinsic) {
    const filtered = workReports
      .filter((r) => r !== undefined)
      .map((r) => r.results[0])
      .filter((r) => r !== undefined && r.serviceId === s);
    const { refinementCount, refinementGasUsed, imports, extrinsicCount, extrinsicSize, exports } = this.calculateRefineScoreService(filtered);

    // TODO [MaSo] Implement a & t calculation
    // https://graypaper.fluffylabs.dev/#/68eaa1f/192e02196b02?v=0.6.4
    const accumulate = { count: 0, gas: 0n };
    const onTransfers = { count: 0, gas: 0n };

    const provided = this.calculateProvidedScoreService(preimages.filter((p) => p !== undefined && p.requester === s));

    return {
      refinementCount,
      refinementGasUsed,
      imports,
      extrinsicCount,
      extrinsicSize,
      exports,
      provided,
      accumulate,
      onTransfers,
    };
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/191103191103?v=0.6.4 */
  private calculateRefineScoreService(workResults: WorkResult[]) {
    const score = {
      refinementCount: 0,
      refinementGasUsed: 0n,
      imports: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exports: 0,
    };

    for (const workResult of workResults) {
      score.refinementCount += 1;
      score.refinementGasUsed += workResult.load.gasUsed;
      score.imports += workResult.load.importedSegments;
      score.extrinsicCount += workResult.load.extrinsicCount;
      score.extrinsicSize += workResult.load.extrinsicSize;
      score.exports += workResult.load.exportedSegments;
    }

    return score;
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/191602191602?v=0.6.4 */
  private calculateProvidedScoreService(preimages: PreimagesExtrinsic) {
    const score = {
      count: 0,
      size: 0,
    };

    for (const preimage of preimages) {
      score.count += 1;
      score.size += preimage.blob.length;
    }

    return score;
  }

  /**
   * https://graypaper.fluffylabs.dev/#/68eaa1f/188903188903?v=0.6.4
   * https://graypaper.fluffylabs.dev/#/68eaa1f/19fc0019fc00?v=0.6.4
   * https://graypaper.fluffylabs.dev/#/68eaa1f/199002199002?v=0.6.4
   */
  transition(input: Input) {
    const { slot, authorIndex, extrinsic, availableReports } = input;
    /**
     * get the validators statistics for the current epoch
     */
    const statistics = this.getStatistics(slot);
    const { current, cores, services } = statistics;
    check(current[authorIndex] !== undefined, "authorIndex is out of bounds");

    current[authorIndex].blocks = tryAsU32(current[authorIndex].blocks + 1);
    current[authorIndex].tickets = tryAsU32(current[authorIndex].tickets + extrinsic.tickets.length);
    current[authorIndex].preImages = tryAsU32(current[authorIndex].preImages + extrinsic.preimages.length);

    /**
     * This value is well bounded by number of blocks in the epoch
     * and maximal amount of preimage data in the extrinsics per one validator.
     * So it can't reach 2GB.
     */
    const preImagesSize = extrinsic.preimages.reduce((sum, preimage) => sum + preimage.blob.length, 0);
    current[authorIndex].preImagesSize = tryAsU32(current[authorIndex].preImagesSize + preImagesSize);

    /**
     * Please note I don't use Kappa' here. If I understand correctly we don't need it.
     * Kappa' is not needed because we can use validator indexes directly from guarantees extrinsic.
     * I asked a question to ensure it is true but I didn't get any response yet:
     * https://github.com/w3f/jamtestvectors/pull/28#discussion_r1907237004
     */
    for (const { credentials } of extrinsic.guarantees) {
      for (const { validatorIndex } of credentials) {
        current[validatorIndex].guarantees = tryAsU32(current[validatorIndex].guarantees + 1);
      }
    }

    for (const { validatorIndex } of extrinsic.assurances) {
      current[validatorIndex].assurances = tryAsU32(current[validatorIndex].assurances + 1);
    }

    const workReports = extrinsic.guarantees.map((r) => r.report).filter((r) => r !== undefined);
    const workReportByCore = new Map<CoreIndex, WorkReport[]>();
    for (const workReport of workReports) {
      const coreIndex = workReport.coreIndex;
      if (!workReportByCore.has(coreIndex)) {
        workReportByCore.set(coreIndex, []);
      }
      workReportByCore.get(coreIndex)?.push(workReport);
    }

    const availableReportsByCore = new Map<CoreIndex, WorkReport[]>();
    for (const availableReport of availableReports) {
      const coreIndex = availableReport.coreIndex;
      if (!availableReportsByCore.has(coreIndex)) {
        availableReportsByCore.set(coreIndex, []);
      }
      availableReportsByCore.get(coreIndex)?.push(availableReport);
    }

    /** Update core statistics */
    for (let coreId = 0; coreId < this.chainSpec.coresCount; coreId++) {
      const coreIndex = tryAsCoreIndex(coreId);
      const coreReports = workReportByCore.get(coreIndex) ?? [];
      const coreAvailableReports = availableReportsByCore.get(coreIndex) ?? [];

      const newCoreStat = this.calculateCoreStatistics(
        tryAsCoreIndex(coreId),
        coreReports,
        coreAvailableReports,
        extrinsic.assurances,
      );

      cores[coreId] = CoreStatistics.fromCodec({
        imports: tryAsU16(newCoreStat.imports),
        exports: tryAsU16(newCoreStat.exports),
        extrinsicSize: tryAsU32(newCoreStat.extrinsicSize),
        extrinsicCount: tryAsU16(newCoreStat.extrinsicCount),
        gasUsed: tryAsServiceGas(newCoreStat.gasUsed),
        bundleSize: tryAsU32(newCoreStat.bundleSize),
        dataAvailabilityLoad: tryAsU32(newCoreStat.dataAvailabilityLoad),
        popularity: tryAsU16(newCoreStat.popularity),
      });
    }

    /** Update services statistics */
    for (const service of services) {
      const serviceId = service[0];
      let serviceStatistics = service[1];

      const newServiceStat = this.calculateServiceStatistics(
        tryAsServiceId(serviceId),
        workReports,
        extrinsic.preimages,
      );

      serviceStatistics = ServiceStatistics.fromCodec({
        imports: tryAsU16(newServiceStat.imports),
        exports: tryAsU16(newServiceStat.exports),
        extrinsicCount: tryAsU16(newServiceStat.extrinsicCount),
        extrinsicSize: tryAsU32(newServiceStat.extrinsicSize),
        refinementCount: tryAsU32(newServiceStat.refinementCount),
        refinementGasUsed: tryAsServiceGas(newServiceStat.refinementGasUsed),
        providedCount: tryAsU16(newServiceStat.provided.count),
        providedSize: tryAsU32(newServiceStat.provided.size),
        accumulateCount: tryAsU32(newServiceStat.accumulate.count),
        accumulateGasUsed: tryAsServiceGas(newServiceStat.accumulate.gas),
        onTransfersCount: tryAsU32(newServiceStat.onTransfers.count),
        onTransfersGasUsed: tryAsServiceGas(newServiceStat.onTransfers.gas),
      });
    }

    /** Update state */
    this.state.statistics = statistics;
  }
}
