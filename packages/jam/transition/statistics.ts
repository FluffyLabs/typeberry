import {
  type Extrinsic,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  type ValidatorIndex,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsServiceGas,
} from "@typeberry/block";
import { W_G } from "@typeberry/block/gp-constants.js";
import type { Preimage, PreimagesExtrinsic } from "@typeberry/block/preimage.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { WorkResult } from "@typeberry/block/work-result.js";
import type { ChainSpec } from "@typeberry/config";
import { type U32, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { ServiceStatistics, type State, StatisticsData } from "@typeberry/state";
import { ValidatorStatistics } from "@typeberry/state";
import { check } from "@typeberry/utils";

export type Input = {
  slot: TimeSlot;
  authorIndex: ValidatorIndex;
  extrinsic: Extrinsic;
  /**
   * `w`: Set of work reports in present extrinsic
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/156c01156c01?v=0.6.5
   */
  incomingReports: WorkReport[];
  /**
   * `W`: Sequence of newly available work-reports
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/145d01145d01?v=0.6.5
   */
  availableReports: WorkReport[];
  /**
   * `I`: Accumulation statistics
   * TODO [MaSo] Use fields from accumulation.
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/171f05171f05?v=0.6.5
   */
  accumulationStatistics: Map<ServiceId, CountAndGasUsed>;
  /**
   * `X`: Deffered transfer statistics
   * TODO [MaSo] Use fields from accumulation.
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/18dd0018dd00?v=0.6.5
   */
  transferStatistics: Map<ServiceId, CountAndGasUsed>;
};

export type CountAndGasUsed = {
  count: U32;
  gasUsed: ServiceGas;
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

  private getStatistics(slot: TimeSlot): StatisticsData {
    /** https://graypaper.fluffylabs.dev/#/68eaa1f/186402186402?v=0.6.4 */
    const currentEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const nextEpoch = Math.floor(slot / this.chainSpec.epochLength);

    /** e === e' */
    if (currentEpoch === nextEpoch) {
      return this.state.statistics;
    }

    /** e !== e' */
    const emptyValidators = tryAsPerValidator(
      Array.from({ length: this.chainSpec.validatorsCount }, () => {
        return ValidatorStatistics.empty();
      }),
      this.chainSpec,
    );

    return StatisticsData.create({
      ...this.state.statistics,
      current: emptyValidators,
      previous: this.state.statistics.current,
    });
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/195601195601?v=0.6.4 */
  private calculateDAScoreCore(availableWorkReports: WorkReport | undefined) {
    if (availableWorkReports === undefined) {
      return tryAsU32(0);
    }

    let sum = 0;

    const workPackageLength = availableWorkReports.workPackageSpec.length;
    const workPackageSegment = Math.ceil((availableWorkReports.workPackageSpec.exportsCount * 65) / 64);
    sum += workPackageLength + W_G * workPackageSegment;

    /** Available work report score can be up to `W_R + W_G * ((W_M * 65) / 64) = 0x00C4_2180` */
    return tryAsU32(sum);
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/191103191103?v=0.6.4 */
  private calculateRefineScore(workResults: WorkResult[]) {
    const score = {
      gasUsed: 0n,
      imported: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exported: 0,
    };

    /** Maximal number of work results is I=16 */
    for (const workResult of workResults) {
      score.gasUsed += workResult.load.gasUsed;
      score.imported += workResult.load.importedSegments;
      score.extrinsicCount += workResult.load.extrinsicCount;
      score.extrinsicSize += workResult.load.extrinsicSize;
      score.exported += workResult.load.exportedSegments;
    }

    return {
      /** Total gas used will never exceed `2**64` */
      gasUsed: tryAsServiceGas(score.gasUsed),
      /** Each result can import, export up to `W_M, W_X = 3072` segments so we are slightly below `2**16` */
      exported: tryAsU16(score.exported),
      imported: tryAsU16(score.imported),
      /** Each result can have up to `T = 128` extrinsics so we are below `2**16` */
      extrinsicCount: tryAsU16(score.extrinsicCount),
      /** Each result can have up to `W_R = 49152` which cannot be over `2**32` */
      extrinsicSize: tryAsU32(score.extrinsicSize),
    };
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/191602191602?v=0.6.4 */
  private calculateProvidedScoreService(preimages: Preimage[]) {
    const score = {
      count: 0,
      size: 0,
    };

    for (const preimage of preimages) {
      score.count += 1;
      score.size += preimage.blob.length;
    }

    return {
      /** Number of preimages can never exceed 2**16 */
      count: tryAsU16(score.count),
      /** Each preimage.blob.length can be up to `W_C = 4_000_000`
       * with maximal size of EACH preimage, number of preimages in block for one service must be `<= 1073` */
      size: tryAsU32(score.size),
    };
  }

  /**
   * Collects all service ids from the following sources:
   * - preimages
   * - work results
   * - accumulation keys
   * - transfer keys
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/195f04195f04?v=0.6.5
   */
  private collectServiceIds(
    preimages: PreimagesExtrinsic,
    workResults: WorkResult[],
    accumulationKeys: MapIterator<ServiceId>,
    transferKeys: MapIterator<ServiceId>,
  ) {
    const serviceIds = new Set<ServiceId>();

    for (const preimage of preimages) {
      serviceIds.add(preimage.requester);
    }
    for (const workResult of workResults) {
      serviceIds.add(workResult.serviceId);
    }
    for (const serviceId of accumulationKeys) {
      serviceIds.add(serviceId);
    }
    for (const serviceId of transferKeys) {
      serviceIds.add(serviceId);
    }

    return serviceIds;
  }

  /**
   * https://graypaper.fluffylabs.dev/#/68eaa1f/188903188903?v=0.6.4
   * https://graypaper.fluffylabs.dev/#/68eaa1f/19fc0019fc00?v=0.6.4
   * https://graypaper.fluffylabs.dev/#/68eaa1f/199002199002?v=0.6.4
   */
  transition(input: Input) {
    const { slot, authorIndex, extrinsic, incomingReports, availableReports } = input;

    /** get statistics for the current epoch */
    const statistics = this.getStatistics(slot);
    const { current, cores, services } = statistics;
    check(current[authorIndex] !== undefined, "authorIndex is out of bounds");

    /** One validator can produce maximal one block per timeslot */
    const newBlocksCount = current[authorIndex].blocks + 1;
    current[authorIndex].blocks = tryAsU32(newBlocksCount);

    const newTicketsCount = current[authorIndex].tickets + extrinsic.tickets.length;
    current[authorIndex].tickets = tryAsU32(newTicketsCount);

    const newPreimagesCount = current[authorIndex].preImages + extrinsic.preimages.length;
    current[authorIndex].preImages = tryAsU32(newPreimagesCount);

    /**
     * This value is well bounded by number of blocks in the epoch
     * and maximal amount of preimage data in the extrinsics per one validator.
     * So it can't reach 2GB.
     */
    const preImagesSize = extrinsic.preimages.reduce((sum, preimage) => sum + preimage.blob.length, 0);
    const newPreImagesSize = current[authorIndex].preImagesSize + preImagesSize;
    current[authorIndex].preImagesSize = tryAsU32(newPreImagesSize);

    /**
     * NOTE [MaSi] Please note I don't use Kappa' here. If I understand correctly we don't need it.
     * Kappa' is not needed because we can use validator indexes directly from guarantees extrinsic.
     * I asked a question to ensure it is true but I didn't get any response yet:
     * https://github.com/w3f/jamtestvectors/pull/28#discussion_r1907237004
     */
    for (const { credentials } of extrinsic.guarantees) {
      for (const { validatorIndex } of credentials) {
        const newGuaranteesCount = current[validatorIndex].guarantees + 1;
        current[validatorIndex].guarantees = tryAsU32(newGuaranteesCount);
      }
    }

    for (const { validatorIndex } of extrinsic.assurances) {
      const newAssurancesCount = current[validatorIndex].assurances + 1;
      current[validatorIndex].assurances = tryAsU32(newAssurancesCount);
    }

    /** Update core statistics */
    for (let coreId = 0; coreId < this.chainSpec.coresCount; coreId++) {
      const coreIndex = tryAsCoreIndex(coreId);

      // NOTE [MaSo] At most one work report per core in the block.
      // https://graypaper.fluffylabs.dev/#/cc517d7/156700156700?v=0.6.5
      const workReport = incomingReports.find((wr) => wr.coreIndex === coreIndex);
      const { imported, extrinsicCount, extrinsicSize, exported, gasUsed } =
        workReport !== undefined
          ? this.calculateRefineScore(workReport.results.map((r) => r))
          : {
              imported: tryAsU16(0),
              extrinsicCount: tryAsU16(0),
              extrinsicSize: tryAsU32(0),
              exported: tryAsU16(0),
              gasUsed: tryAsServiceGas(0n),
            };

      // NOTE [MaSo] At most one work report per core in the block.
      // https://graypaper.fluffylabs.dev/#/cc517d7/145d01145d01?v=0.6.5
      const availableWorkReport = availableReports.find((wr) => wr.coreIndex === coreIndex);
      const popularity = extrinsic.assurances.reduce((sum, { bitfield }) => sum + (bitfield.isSet(coreId) ? 1 : 0), 0);

      /**
       * Core statistics are tracked only per-block basis, so we override previous values.
       * https://graypaper.fluffylabs.dev/#/cc517d7/190201190501?v=0.6.5
       */
      cores[coreIndex].imports = imported;
      cores[coreIndex].extrinsicCount = extrinsicCount;
      cores[coreIndex].extrinsicSize = extrinsicSize;
      cores[coreIndex].exports = exported;
      cores[coreIndex].gasUsed = gasUsed;
      cores[coreIndex].bundleSize = tryAsU32(workReport?.workPackageSpec.length ?? 0);
      cores[coreIndex].dataAvailabilityLoad = this.calculateDAScoreCore(availableWorkReport);
      cores[coreIndex].popularity = tryAsU16(popularity);
    }

    /** Update services statistics */
    services.clear();
    const serviceIds = this.collectServiceIds(
      extrinsic.preimages,
      incomingReports.flatMap((wr) => wr.results),
      input.accumulationStatistics.keys(),
      input.transferStatistics.keys(),
    );

    for (const serviceId of serviceIds) {
      const serviceStatistics = ServiceStatistics.empty();

      const workResults = incomingReports.flatMap((wr) => wr.results.filter((r) => r.serviceId === serviceId));
      const { gasUsed, imported, extrinsicCount, extrinsicSize, exported } = this.calculateRefineScore(workResults);

      const preimages = extrinsic.preimages.filter((preimage) => preimage.requester === serviceId);
      const { count: providedCount, size: providedSize } = this.calculateProvidedScoreService(preimages);

      const { count: accumulatedCount, gasUsed: accumulatedGasUsed } = input.accumulationStatistics.get(serviceId) ?? {
        count: tryAsU32(0),
        gasUsed: tryAsServiceGas(0n),
      };

      const { count: transfersCount, gasUsed: transfersGasUsed } = input.transferStatistics.get(serviceId) ?? {
        count: tryAsU32(0),
        gasUsed: tryAsServiceGas(0n),
      };

      /**
       * Service statistics are tracked only per-block basis, so we override previous values.
       * https://graypaper.fluffylabs.dev/#/cc517d7/190201190501?v=0.6.5
       */
      serviceStatistics.refinementCount = tryAsU32(workResults.length);
      serviceStatistics.refinementGasUsed = gasUsed;
      serviceStatistics.imports = imported;
      serviceStatistics.extrinsicCount = extrinsicCount;
      serviceStatistics.extrinsicSize = extrinsicSize;
      serviceStatistics.exports = exported;
      serviceStatistics.providedCount = providedCount;
      serviceStatistics.providedSize = providedSize;
      serviceStatistics.providedCount = providedCount;
      serviceStatistics.providedSize = providedSize;
      serviceStatistics.accumulateCount = accumulatedCount;
      serviceStatistics.accumulateGasUsed = accumulatedGasUsed;
      serviceStatistics.onTransfersCount = transfersCount;
      serviceStatistics.onTransfersGasUsed = transfersGasUsed;

      services.set(serviceId, serviceStatistics);
    }

    /** Update state */
    this.state.statistics = statistics;
  }
}
