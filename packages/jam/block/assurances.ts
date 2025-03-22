import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, type DescribedBy, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";
import { codecKnownSizeArray, codecWithContext } from "./codec";
import type { ValidatorIndex } from "./common";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import type { HeaderHash } from "./hash";

/**
 *
 * A work-report is said to become available iff there are a clear
 * 2/3 supermajority of validators who have marked its core as set within
 * the block's assurance extrinsic.
 * https://graypaper.fluffylabs.dev/#/579bd12/145800145c00
 */
export class AvailabilityAssurance extends WithDebug {
  static Codec = codec.Class(AvailabilityAssurance, {
    anchor: codec.bytes(HASH_SIZE).asOpaque(),
    bitfield: codecWithContext((context) => {
      return codec.bitVecFixLen(context.coresCount);
    }),
    validatorIndex: codec.u16.asOpaque(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).asOpaque(),
  });

  static fromCodec({ anchor, bitfield, validatorIndex, signature }: CodecRecord<AvailabilityAssurance>) {
    return new AvailabilityAssurance(anchor, bitfield, validatorIndex, signature);
  }

  constructor(
    /**
     * The assurances must all be anchored on the parent.
     * https://graypaper.fluffylabs.dev/#/579bd12/145800145c00
     */
    public readonly anchor: HeaderHash,
    /**
     * A series of binary values, one per core.
     *
     * Value of `1` implies that  the validator assures they are contributing
     * to that's core validity.
     */
    public readonly bitfield: BitVec,
    /** Validator index that signed this assurance. */
    public readonly validatorIndex: ValidatorIndex,
    /** Signature over the anchor and the bitfield. */
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

const AssurancesExtrinsicBounds = "[0 .. ValidatorsCount)";
/**
 * `E_A`: Sequence with at most one item per validator.
 *
 * Assurances must be ordered by validator index.
 * https://graypaper.fluffylabs.dev/#/579bd12/145800145c00
 */
export type AssurancesExtrinsic = KnownSizeArray<AvailabilityAssurance, typeof AssurancesExtrinsicBounds>;

export const assurancesExtrinsicCodec = codecWithContext((context) => {
  return codecKnownSizeArray(
    AvailabilityAssurance.Codec,
    {
      minLength: 0,
      maxLength: context.validatorsCount,
      typicalLength: context.validatorsCount / 2,
    },
    AssurancesExtrinsicBounds,
  );
});

export type AssurancesExtrinsicView = DescribedBy<typeof assurancesExtrinsicCodec.View>;
