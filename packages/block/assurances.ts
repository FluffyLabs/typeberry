import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { EST_CORES } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { WithDebug, asOpaqueType } from "@typeberry/utils";
import type { ValidatorIndex } from "./common";
import { withContext } from "./context";
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
    bitfield: codec.select(
      {
        name: "AvailabilityAssurance.bitfield",
        sizeHint: { bytes: Math.ceil(EST_CORES / 8), isExact: false },
      },
      withContext("AvailabilityAssurance.bitfield", (context) => {
        return codec.bitVecFixLen(Math.ceil(context.coresCount / 8) * 8);
      }),
    ),
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

/**
 * `E_A`: Sequence with at most one item per validator.
 *
 * Assurances must be ordered by validator index.
 * https://graypaper.fluffylabs.dev/#/579bd12/145800145c00
 */
export type AssurancesExtrinsic = KnownSizeArray<AvailabilityAssurance, "0 .. ValidatorsCount">;

// TODO [ToDr] constrain the sequence length during decoding.
export const assurancesExtrinsicCodec = codec
  .sequenceVarLen(AvailabilityAssurance.Codec)
  .convert<AssurancesExtrinsic>((i) => i, asOpaqueType);
