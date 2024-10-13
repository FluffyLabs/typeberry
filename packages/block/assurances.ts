import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ValidatorIndex } from "./common";
import { ChainSpec, EST_CORES } from "./context";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import { HASH_SIZE, type HeaderHash } from "./hash";

/**
 *
 * A work-report is said to become available iff there are a clear
 * 2/3 supermajority of validators who have marked its core as set within
 * the block's assurance extrinsic.
 * https://graypaper.fluffylabs.dev/#/c71229b/135201135601
 */
export class AvailabilityAssurance {
  static Codec = codec.Class(AvailabilityAssurance, {
    anchor: codec.bytes(HASH_SIZE).cast(),
    bitfield: codec.select(
      {
        name: "AvailabilityAssurance.bitfield",
        sizeHintBytes: Math.ceil(EST_CORES / 8),
      },
      (context) => {
        if (context instanceof ChainSpec) {
          return codec.bitVecFixLen(Math.ceil(context.coresCount / 8) * 8);
        }
        throw new Error("Missing context object to decode `AvailabilityAssurance.bitfield`.");
      },
    ),
    validatorIndex: codec.u16.cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ anchor, bitfield, validatorIndex, signature }: CodecRecord<AvailabilityAssurance>) {
    return new AvailabilityAssurance(anchor, bitfield, validatorIndex, signature);
  }

  constructor(
    /**
     * The assurances must all be anchored on the parent.
     * https://graypaper.fluffylabs.dev/#/c71229b/135201135601
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
  ) {}
}

/**
 * `E_A`: Sequence with at most one item per validator.
 *
 * Assurances must be ordered by validator index.
 * https://graypaper.fluffylabs.dev/#/c71229b/135201135601
 */
export type AssurancesExtrinsic = KnownSizeArray<AvailabilityAssurance, "0 .. ValidatorsCount">;

// TODO [ToDr] constrain the sequence length during decoding.
export const assurancesExtrinsicCodec = codec.sequenceVarLen(AvailabilityAssurance.Codec).cast<AssurancesExtrinsic>();
