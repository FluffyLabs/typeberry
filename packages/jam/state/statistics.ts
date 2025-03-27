import { type PerValidator, codecPerValidator } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { type U32, tryAsU32 } from "@typeberry/numbers";

/**
 * Activity Record of a single validator.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/183701183701
 */
export class ActivityRecord {
  static Codec = codec.Class(ActivityRecord, {
    blocks: codec.u32,
    tickets: codec.u32,
    preImages: codec.u32,
    preImagesSize: codec.u32,
    guarantees: codec.u32,
    assurances: codec.u32,
  });

  static fromCodec({ blocks, tickets, preImages, preImagesSize, guarantees, assurances }: CodecRecord<ActivityRecord>) {
    return new ActivityRecord(blocks, tickets, preImages, preImagesSize, guarantees, assurances);
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
    return new ActivityRecord(zero, zero, zero, zero, zero, zero);
  }
}

/** `pi`: Previous and current statistics of each validator. */
export class ActivityData {
  static Codec = codec.Class(ActivityData, {
    current: codecPerValidator(ActivityRecord.Codec),
    previous: codecPerValidator(ActivityRecord.Codec),
  });

  static fromCodec(v: CodecRecord<ActivityData>) {
    return new ActivityData(v);
  }

  public current: PerValidator<ActivityRecord>;
  public previous: PerValidator<ActivityRecord>;

  constructor({ current, previous }: CodecRecord<ActivityData>) {
    this.current = current;
    this.previous = previous;
  }
}
