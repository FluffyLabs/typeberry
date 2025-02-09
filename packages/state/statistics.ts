import type { PerValidator } from "@typeberry/block";
import { type U32, tryAsU32 } from "@typeberry/numbers";

// TODO [ToDr] Codec

/** `pi`: Previous and current statistics of each validator. */
export class ActivityData {
  public current: PerValidator<ActivityRecord>;
  public previous: PerValidator<ActivityRecord>;

  constructor({ current, previous }: Record<"current" | "previous", ActivityData["current"]>) {
    this.current = current;
    this.previous = previous;
  }
}

/**
 * Activity Record of a single validator.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/183701183701
 */
export class ActivityRecord {
  constructor(
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
