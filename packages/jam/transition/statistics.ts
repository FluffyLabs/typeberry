import { type Extrinsic, type TimeSlot, type ValidatorIndex, tryAsPerValidator } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU32 } from "@typeberry/numbers";
import type { State } from "@typeberry/state";
import { ActivityRecord } from "@typeberry/state";
import { check } from "@typeberry/utils";

export type StatisticsState = Pick<State, "timeslot"> & {
  statisticsPerValidator: State["statisticsPerValidator"];
  /**
   * `kappa_prime`: Posterior active validators
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/188c02188d02
   */
  readonly currentValidatorData: State["currentValidatorData"];
};

export class Statistics {
  constructor(
    private readonly chainSpec: ChainSpec,
    public readonly state: StatisticsState,
  ) {}

  private getValidatorsStatistics(slot: TimeSlot) {
    /** https://graypaper.fluffylabs.dev/#/579bd12/18b80118b801 */
    const currentEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const nextEpoch = Math.floor(slot / this.chainSpec.epochLength);

    /** e === e' */
    if (currentEpoch === nextEpoch) {
      return this.state.statisticsPerValidator;
    }

    /** e !== e' */
    const current = Array(this.chainSpec.validatorsCount)
      .fill(0)
      .map(() => ActivityRecord.empty());

    return {
      current: tryAsPerValidator(current, this.chainSpec),
      previous: this.state.statisticsPerValidator.current,
    };
  }

  transition(slot: TimeSlot, authorIndex: ValidatorIndex, extrinsic: Extrinsic) {
    /**
     * get the validators statistics for the current epoch
     */
    const validatorsStatistics = this.getValidatorsStatistics(slot);
    const { current } = validatorsStatistics;
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
        current[validatorIndex].guarantees = tryAsU32(current[validatorIndex].guarantees + 1);
      }
    }

    /**
     * https://graypaper.fluffylabs.dev/#/579bd12/189902189902
     */
    for (const assurance of extrinsic.assurances) {
      current[assurance.validatorIndex].assurances = tryAsU32(current[assurance.validatorIndex].assurances + 1);
    }

    /**
     * update the state with the new validators statistics
     */
    this.state.statisticsPerValidator = validatorsStatistics;
  }
}
