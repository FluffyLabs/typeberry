import { type Extrinsic, type TimeSlot, type ValidatorIndex, tryAsPerValidator } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU32 } from "@typeberry/numbers";
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
export type StatisticsState = {
  statistics: State["statistics"];
  slot: State["timeslot"];
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
    const currentEpoch = Math.floor(this.state.slot / this.chainSpec.epochLength);
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

  transition(input: Input) {
    const { slot, authorIndex, extrinsic } = input;
    /**
     * get the validators statistics for the current epoch
     */
    const statistics = this.getStatistics(slot);
    const { current } = statistics;
    check(current[authorIndex] !== undefined, "authorIndex is out of bounds");

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/180802180802
     */

    current[authorIndex].blocks = tryAsU32(current[authorIndex].blocks + 1);

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/181b02181b02
     */
    current[authorIndex].tickets = tryAsU32(current[authorIndex].tickets + extrinsic.tickets.length);

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/183f02185702
     */
    current[authorIndex].preImages = tryAsU32(current[authorIndex].preImages + extrinsic.preimages.length);

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/186302186302
     *
     * This value is well bounded by number of blocks in the epoch and maximal amount of preimage data in the extrinsics per one validator. So it can't reach 2GB.
     */
    const preImagesSize = extrinsic.preimages.reduce((sum, preimage) => sum + preimage.blob.length, 0);
    current[authorIndex].preImagesSize = tryAsU32(current[authorIndex].preImagesSize + preImagesSize);

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/188902188d02
     *
     * Please note I don't use Kappa' here. If I understand correctly we don't need it.
     * Kappa' is not needed because we can use validator indexes directly from guarantees extrinsic.
     * I asked a question to ensure it is true but I didn't get any response yet:
     * https://github.com/w3f/jamtestvectors/pull/28#discussion_r1907237004
     */

    for (const { credentials } of extrinsic.guarantees) {
      for (const { validatorIndex } of credentials) {
        if (validatorIndex === authorIndex) {
          current[authorIndex].guarantees = tryAsU32(current[authorIndex].guarantees + 1);
          break;
        }
      }
    }

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/189902189902
     */
    for (const { validatorIndex } of extrinsic.assurances) {
      if (validatorIndex === authorIndex) {
        current[authorIndex].assurances = tryAsU32(current[authorIndex].assurances + 1);
        break;
      }
    }

    /** Update core statistics */

    /** Update services statistics */

    /** Update state */
    this.state.statistics = statistics;
  }
}
