import type { TimeSlot, ValidatorData } from "@typeberry/block";
import { type U32, tryAsU32 } from "@typeberry/numbers";

/**
 * https://graypaper.fluffylabs.dev/#/6e1c0cd/187a01187a01
 */
export class ActivityRecord {
  constructor(
    /**
     * The number of blocks produced by the validator.
     *
     */
    public blocks: U32,

    /**
     * The number of tickets introduced by the validator.
     *
     */
    public tickets: U32,

    /**
     * The number of preimages introduced by the validator.
     *
     */
    public preImages: U32,

    /**
     * The total number of octets across all preimages introduced by the validator.
     */
    public preImagesSize: U32,

    /**
     * The number of reports guaranteed by the validator.
     */
    public guarantees: U32,

    /**
     * The number of availability assurances made by the validator.
     */
    public assurances: U32,
  ) {}

  static empty() {
    const zero = tryAsU32(0);
    return new ActivityRecord(zero, zero, zero, zero, zero, zero);
  }
}
export class StatisticsState {
  constructor(
    /**
     * `pi`: Previous and current statistics of each validator.
     *
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/185d01185f01
     */
    public statisticsPerValidator: {
      current: ActivityRecord[];
      previous: ActivityRecord[];
    },

    /**
     * The current time slot.
     *
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18a70118a701
     */
    public tau: TimeSlot,

    /**
     * Posterior active validators
     *
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18cf0218d002
     */
    public kappaPrime: ValidatorData[],
  ) {}
}
