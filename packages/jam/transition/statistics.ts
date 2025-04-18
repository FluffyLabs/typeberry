import {
  type CoreIndex,
  type Extrinsic,
  type ServiceGas,
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
import { MAX_U16, MAX_U32, type U16, type U32, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import type { State } from "@typeberry/state";
import { CoreStatistics, ServiceStatistics, ValidatorStatistics } from "@typeberry/state";
import { check } from "@typeberry/utils";

export type Input = {
  slot: TimeSlot;
  authorIndex: ValidatorIndex;
  extrinsic: Extrinsic;
  availableReports: WorkReport[];
};

export type ServiceStat = {
  refinementCount: U32;
  refinementGasUsed: ServiceGas;
  imports: U16;
  extrinsicCount: U16;
  extrinsicSize: U32;
  exports: U16;
  provided: {
    count: U16;
    size: U32;
  };
  accumulate: {
    count: U32;
    gas: ServiceGas;
  };
  onTransfers: {
    count: U32;
    gas: ServiceGas;
  };
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
    coreIndex: CoreIndex,
    workReports: WorkReport[],
    availableReports: WorkReport[],
    availabilityAssurances: AvailabilityAssurance[],
  ): CoreStatistics {
    const { imports, extrinsicCount, extrinsicSize, exports, gasUsed, bundleSize } =
      this.calculateRefineScoreCore(workReports);
    const dataAvailabilityLoad = this.calculateDictionaryScoreCore(availableReports);
    const popularity = this.calculatePopularityScoreCore(coreIndex, availabilityAssurances);

    return CoreStatistics.fromCodec({
      imports,
      extrinsicCount,
      extrinsicSize,
      exports,
      gasUsed,
      bundleSize,
      dataAvailabilityLoad,
      popularity,
    });
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

    check(score.imports < MAX_U16, "Imports count overflows");
    check(score.extrinsicCount < MAX_U16, "Extrinsic count overflows");
    check(score.extrinsicSize < MAX_U32, "Provided size overflows");
    check(score.exports < MAX_U16, "Exports count overflows");
    check(score.bundleSize < MAX_U32, "Refinement count overflows");

    return {
      imports: tryAsU16(score.imports),
      extrinsicCount: tryAsU16(score.extrinsicCount),
      extrinsicSize: tryAsU32(score.extrinsicSize),
      exports: tryAsU16(score.exports),
      gasUsed: tryAsServiceGas(score.gasUsed),
      bundleSize: tryAsU32(score.bundleSize),
    };
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/195601195601?v=0.6.4 */
  private calculateDictionaryScoreCore(availableWorkReports: WorkReport[]) {
    let sum = 0;

    for (const r of availableWorkReports) {
      const workPackageLength = r.workPackageSpec.length;
      const workPackageSegment = Math.ceil((r.workPackageSpec.exportsCount * 65) / 64);
      sum += workPackageLength + W_G * workPackageSegment;
    }

    check(sum < MAX_U32, "Dictionary score overflows");
    return tryAsU32(sum);
  }

  private calculatePopularityScoreCore(coreIndex: CoreIndex, availabilityAssurances: AvailabilityAssurance[]) {
    let sum = 0;
    for (const assurance of availabilityAssurances) {
      if (assurance === undefined || assurance.bitfield === undefined) {
        continue;
      }
      sum += assurance.bitfield.isSet(coreIndex) ? 1 : 0;
    }

    check(sum < MAX_U16, "Popularity score overflows");
    return tryAsU16(sum);
  }

  /**
   * Calculate service statistics
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/199002199002?v=0.6.4
   */
  public calculateServiceStatistics(
    s: ServiceId,
    workReports: WorkReport[],
    preimages: PreimagesExtrinsic,
  ): ServiceStatistics {
    const filtered = workReports.flatMap((wr) => wr.results).filter((r) => r?.serviceId === s);
    const { refinementCount, refinementGasUsed, imports, extrinsicCount, extrinsicSize, exports } =
      this.calculateRefineScoreService(filtered);

    const accumulate = this.calculateAccumulateScoreService();
    const onTransfers = this.calculateOnTransferScoreService();

    const provided = this.calculateProvidedScoreService(preimages.filter((p) => p !== undefined && p.requester === s));

    return ServiceStatistics.fromCodec({
      refinementCount,
      refinementGasUsed,
      imports,
      extrinsicCount,
      extrinsicSize,
      exports,
      providedCount: provided.count,
      providedSize: provided.size,
      accumulateCount: accumulate.count,
      accumulateGasUsed: accumulate.gas,
      onTransfersCount: onTransfers.count,
      onTransfersGasUsed: onTransfers.gas,
    });
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

    check(score.refinementCount < MAX_U32, "Refinement count overflows");
    check(score.imports < MAX_U16, "Imports count overflows");
    check(score.extrinsicCount < MAX_U16, "Extrinsic count overflows");
    check(score.extrinsicSize < MAX_U32, "Provided size overflows");
    check(score.exports < MAX_U16, "Exports count overflows");

    return {
      refinementCount: tryAsU32(score.refinementCount),
      refinementGasUsed: tryAsServiceGas(score.refinementGasUsed),
      imports: tryAsU16(score.imports),
      extrinsicCount: tryAsU16(score.extrinsicCount),
      extrinsicSize: tryAsU32(score.extrinsicSize),
      exports: tryAsU16(score.exports),
    };
  }

  private calculateAccumulateScoreService() {
    // TODO [MaSo] Implement a & t calculation
    // https://graypaper.fluffylabs.dev/#/68eaa1f/192e02196b02?v=0.6.4
    return {
      count: tryAsU32(0),
      gas: tryAsServiceGas(0n),
    };
  }

  private calculateOnTransferScoreService() {
    // TODO [MaSo] Implement a & t calculation
    // https://graypaper.fluffylabs.dev/#/68eaa1f/192e02196b02?v=0.6.4
    return {
      count: tryAsU32(0),
      gas: tryAsServiceGas(0n),
    };
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

    check(score.count < MAX_U16, "Provided count overflows");
    check(score.size < MAX_U32, "Provided size overflows");

    return {
      count: tryAsU16(score.count),
      size: tryAsU32(score.size),
    };
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

    const newBlocksCount = current[authorIndex].blocks + 1;
    check(newBlocksCount < MAX_U32, "Blocks count overflows");
    current[authorIndex].blocks = tryAsU32(newBlocksCount);

    const newTicketsCount = current[authorIndex].tickets + extrinsic.tickets.length;
    check(newTicketsCount < MAX_U32, "Tickets count overflows");
    current[authorIndex].tickets = tryAsU32(newTicketsCount);

    const newPreimagesCount = current[authorIndex].preImages + extrinsic.preimages.length;
    check(newPreimagesCount < MAX_U32, "Preimages count overflows");
    current[authorIndex].preImages = tryAsU32(newPreimagesCount);

    /**
     * This value is well bounded by number of blocks in the epoch
     * and maximal amount of preimage data in the extrinsics per one validator.
     * So it can't reach 2GB.
     */
    const preImagesSize = extrinsic.preimages.reduce((sum, preimage) => sum + preimage.blob.length, 0);
    const newPreImagesSize = current[authorIndex].preImagesSize + preImagesSize;
    check(newPreImagesSize < MAX_U32, "Preimages size overflows");
    current[authorIndex].preImagesSize = tryAsU32(newPreImagesSize);

    /**
     * Please note I don't use Kappa' here. If I understand correctly we don't need it.
     * Kappa' is not needed because we can use validator indexes directly from guarantees extrinsic.
     * I asked a question to ensure it is true but I didn't get any response yet:
     * https://github.com/w3f/jamtestvectors/pull/28#discussion_r1907237004
     */
    for (const { credentials } of extrinsic.guarantees) {
      for (const { validatorIndex } of credentials) {
        check(current[validatorIndex] !== undefined, "Validator index is out of bounds");

        const newGuaranteesCount = current[validatorIndex].guarantees + 1;
        check(newGuaranteesCount < MAX_U32, "Guarantees count overflows");
        current[validatorIndex].guarantees = tryAsU32(newGuaranteesCount);
      }
    }

    for (const { validatorIndex } of extrinsic.assurances) {
      check(current[validatorIndex] !== undefined, "Validator index is out of bounds");

      const newAssurancesCount = current[validatorIndex].assurances + 1;
      check(newAssurancesCount < MAX_U32, "Assurances count overflows");
      current[validatorIndex].assurances = tryAsU32(newAssurancesCount);
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

      cores[coreId] = newCoreStat;
    }

    /** Update services statistics */
    for (let [serviceId, _serviceStatistics] of services.entries()) {
      const newServiceStat = this.calculateServiceStatistics(
        tryAsServiceId(serviceId),
        workReports,
        extrinsic.preimages,
      );

      _serviceStatistics = newServiceStat;
    }

    /** Update state */
    this.state.statistics = statistics;
  }
}
