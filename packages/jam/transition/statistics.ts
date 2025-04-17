import {
  type CoreIndex,
  type Extrinsic,
  type ServiceId,
  type TimeSlot,
  type ValidatorIndex,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsServiceId,
} from "@typeberry/block";
import type { AvailabilityAssurance } from "@typeberry/block/assurances";
import { W_G } from "@typeberry/block/gp-constants";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { WorkReport } from "@typeberry/block/work-report";
import type { WorkResult } from "@typeberry/block/work-result";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import type { State } from "@typeberry/state";
import { ValidatorStatistics } from "@typeberry/state";
import { check } from "@typeberry/utils";

export type Input = {
  slot: TimeSlot;
  authorIndex: ValidatorIndex;
  extrinsic: Extrinsic;
  availableReports: WorkReport[];
};

/**
 * https://graypaper.fluffylabs.dev/#/68eaa1f/18f60118f601?v=0.6.4
 */
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
    /** https://graypaper.fluffylabs.dev/#/579bd12/18b80118b801 */
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
      current: tryAsPerValidator(current, this.chainSpec),
      previous: this.state.statistics.current,
      cores: this.state.statistics.cores,
      services: this.state.statistics.services,
    };
  }

  private calculateCoreStatistics(
    c: CoreIndex,
    workReports: WorkReport[],
    availableReports: WorkReport[],
    availabilityAssurances: AvailabilityAssurance[],
  ) {
    const { i, x, z, e, u, b } = this.calculateRefineScoreCore(
      workReports.filter((r) => r !== undefined && r.coreIndex === c),
    );
    const d = this.calculateDictionaryScoreCore(availableReports.filter((r) => r !== undefined && r.coreIndex === c));
    const p = availabilityAssurances.reduce((sum, assurance) => {
      if (assurance === undefined || assurance.bitfield === undefined) {
        return sum;
      }
      return sum + (assurance.bitfield.isSet(c) ? 1 : 0);
    }, 0);

    return {
      i,
      x,
      z,
      e,
      u,
      b,
      d,
      p,
    };
  }

  private calculateRefineScoreCore(workReports: WorkReport[]) {
    const score = {
      i: 0,
      x: 0,
      z: 0,
      e: 0,
      u: 0n,
      b: 0,
    };

    for (const workReport of workReports) {
      for (const workResult of workReport.results.map((r) => r)) {
        score.i += workResult.load.importedSegments;
        score.x += workResult.load.extrinsicCount;
        score.z += workResult.load.extrinsicSize;
        score.e += workResult.load.exportedSegments;
        score.u += workResult.load.gasUsed;
      }
      score.b += workReport.workPackageSpec.length;
    }

    return score;
  }

  private calculateDictionaryScoreCore(availableWorkReports: WorkReport[]) {
    let sum = 0;

    for (const r of availableWorkReports) {
      const workPackageLength = r.workPackageSpec.length;
      const workPackageSegment = Math.ceil((r.workPackageSpec.exportsCount * 65) / 64);
      sum += workPackageLength + W_G * workPackageSegment;
    }

    return sum;
  }

  // TODO [MaSo] Implement Service statistics calculation
  // https://graypaper.fluffylabs.dev/#/68eaa1f/17e90417e904?v=0.6.4
  // https://graypaper.fluffylabs.dev/#/68eaa1f/17f70317f703?v=0.6.4
  // https://graypaper.fluffylabs.dev/#/68eaa1f/064b00064b00?v=0.6.4
  /**
   * Calculate service statistics
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/199002199002?v=0.6.4
   */
  private calculateServiceStatistics(s: ServiceId, workReports: WorkReport[], preimages: PreimagesExtrinsic) {
    const filtered = workReports
      .filter((r) => r !== undefined)
      .map((r) => r.results[0])
      .filter((r) => r !== undefined && r.serviceId === s);
    const { n, u, i, x, z, e } = this.calculateRefineScoreService(filtered);

    // TODO [MaSo] Implement a & t calculation
    // https://graypaper.fluffylabs.dev/#/68eaa1f/192e02196b02?v=0.6.4

    const p = this.calculateProvidedScoreService(preimages.filter((p) => p !== undefined && p.requester === s));

    return {
      n,
      u,
      i,
      x,
      z,
      e,
      p,
    };
  }

  private calculateRefineScoreService(workResults: WorkResult[]) {
    const score = {
      n: 0,
      u: 0n,
      i: 0,
      x: 0,
      z: 0,
      e: 0,
    };

    for (const workResult of workResults) {
      score.n += 1;
      score.u += workResult.load.gasUsed;
      score.i += workResult.load.importedSegments;
      score.x += workResult.load.extrinsicCount;
      score.z += workResult.load.extrinsicSize;
      score.e += workResult.load.exportedSegments;
    }

    return score;
  }

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
   * https://graypaper.fluffylabs.dev/#/579bd12/180802180802
   */
  transition(input: Input) {
    const { slot, authorIndex, extrinsic, availableReports } = input;
    /**
     * get the validators statistics for the current epoch
     */
    const statistics = this.getStatistics(slot);
    const { current } = statistics;
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

    const workReports = extrinsic.guarantees.map((r) => r.report);
    /** Update core statistics */
    for (let coreId = 0; coreId < this.state.statistics.cores.length; coreId++) {
      const coreStat = this.calculateCoreStatistics(
        tryAsCoreIndex(coreId),
        workReports,
        availableReports,
        extrinsic.assurances,
      );
      statistics.cores[coreId].imports = tryAsU16(coreStat.i);
      statistics.cores[coreId].exports = tryAsU16(coreStat.x);
      statistics.cores[coreId].extrinsicSize = tryAsU32(coreStat.z);
      statistics.cores[coreId].extrinsicCount = tryAsU16(coreStat.e);
      statistics.cores[coreId].gasUsed = tryAsGas(coreStat.u);
      statistics.cores[coreId].bandleSize = tryAsU32(coreStat.b);
      statistics.cores[coreId].dataAvailabilityLoad = tryAsU32(coreStat.d);
      statistics.cores[coreId].popularity = tryAsU16(coreStat.p);
    }

    /** Update services statistics */
    for (const service of this.state.statistics.services) {
      const serviceStat = this.calculateServiceStatistics(tryAsServiceId(service[0]), workReports, extrinsic.preimages);
      service[1].imports = tryAsU16(serviceStat.i);
      service[1].exports = tryAsU16(serviceStat.x);
      service[1].extrinsicSize = tryAsU32(serviceStat.z);
      service[1].extrinsicCount = tryAsU16(serviceStat.e);
      service[1].refinementCount = tryAsU32(serviceStat.n);
      service[1].refinementGasUsed = tryAsGas(serviceStat.u);
      service[1].providedCount = tryAsU16(serviceStat.p.count);
      service[1].providedSize = tryAsU32(serviceStat.p.size);
      // a.0
      // a.1
      // t.0
      // t.1
    }

    /** Update state */
    this.state.statistics = statistics;
  }
}
