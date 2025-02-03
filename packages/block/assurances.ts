import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, type DescribedBy, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { EST_CORES } from "@typeberry/config";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import { WithDebug, asOpaqueType } from "@typeberry/utils";
import type { TimeSlot, ValidatorIndex } from "./common";
import { withContext } from "./context";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import type { HeaderHash, WorkReportHash } from "./hash";
import type { WorkReport } from "./work-report";

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
        return codec.bitVecFixLen(context.coresCount);
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
 * Assignment of particular work report to a core.
 *
 * Used by "Assurances" and "Disputes" subsystem, denoted by `rho`
 * in state.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/135800135800
 */
export class AvailabilityAssignment extends WithDebug {
  constructor(
    /** Work report assigned to a core. */
    public readonly workReport: WithHash<WorkReportHash, WorkReport>,
    /** Time slot at which the report becomes obsolete. */
    public readonly timeout: TimeSlot,
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

export type AssurancesExtrinsicView = DescribedBy<typeof assurancesExtrinsicCodec.View>;
