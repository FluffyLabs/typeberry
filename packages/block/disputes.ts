import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { type Epoch, type ValidatorIndex, WithDebug } from "./common";
import { EST_VALIDATORS_SUPER_MAJORITY, withContext } from "./context";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, type Ed25519Key, type Ed25519Signature } from "./crypto";
import { HASH_SIZE, type WorkReportHash } from "./hash";

/**
 * Proof of signing a contradictory [`Judgement`] of a work report.
 */
export class Fault extends WithDebug {
  static Codec = codec.Class(Fault, {
    workReportHash: codec.bytes(HASH_SIZE).cast(),
    wasConsideredValid: codec.bool,
    key: codec.bytes(ED25519_KEY_BYTES).cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ workReportHash, wasConsideredValid, key, signature }: CodecRecord<Fault>) {
    return new Fault(workReportHash, wasConsideredValid, key, signature);
  }

  constructor(
    /** Hash of the work-report that had conflicting votes. */
    public readonly workReportHash: WorkReportHash,
    /** Did the validator consider this work-report valid in their [`Judgement`]? */
    public readonly wasConsideredValid: boolean,
    /** Validator key that provided the signature. */
    public readonly key: Ed25519Key,
    /** Original signature that was part of the [`Judgement`]. */
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

/**
 * Proof of guaranteeing a work-report found to be invalid.
 */
export class Culprit extends WithDebug {
  static Codec = codec.Class(Culprit, {
    workReportHash: codec.bytes(HASH_SIZE).cast(),
    key: codec.bytes(ED25519_KEY_BYTES).cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ workReportHash, key, signature }: CodecRecord<Culprit>) {
    return new Culprit(workReportHash, key, signature);
  }

  constructor(
    /** Hash of the invalid work-report. */
    public readonly workReportHash: WorkReportHash,
    /** Validator key that provided the signature. */
    public readonly key: Ed25519Key,
    /** Original signature that was part of the [`Judgement`]. */
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

/**
 * A vote for validity or invalidity of a [`WorkReport`] signed by a particular validator.
 */
export class Judgement extends WithDebug {
  static Codec = codec.Class(Judgement, {
    isWorkReportValid: codec.bool,
    index: codec.u16.cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ isWorkReportValid, index, signature }: CodecRecord<Judgement>) {
    return new Judgement(isWorkReportValid, index, signature);
  }

  constructor(
    /** Whether the work report is considered valid or not. */
    public readonly isWorkReportValid: boolean,
    /** Index of the validator that signed this vote. */
    public readonly index: ValidatorIndex,
    /** The signature. */
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

/**
 * Votes by super majority of the validator set
 * (either using keys from current epoch or previous)
 * over validity or invalidity of a particular [`WorkReport`].
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/12af0012af00
 */
export class Verdict extends WithDebug {
  static Codec = codec.Class(Verdict, {
    workReportHash: codec.bytes(HASH_SIZE).cast(),
    votesEpoch: codec.u32.cast(),
    votes: codec.select(
      {
        name: "Verdict.votes",
        sizeHintBytes: EST_VALIDATORS_SUPER_MAJORITY * Judgement.Codec.sizeHintBytes,
      },
      withContext("Verdicts.votes", (context) => {
        return codec.sequenceFixLen(Judgement.Codec, context.validatorsSuperMajority).cast();
      }),
    ),
  });

  static fromCodec({ workReportHash, votesEpoch, votes }: CodecRecord<Verdict>) {
    return new Verdict(workReportHash, votesEpoch, votes);
  }

  constructor(
    /** Hash of the work report the verdict is for. */
    public readonly workReportHash: WorkReportHash,
    /**
     *  The epoch from which the validators signed the votes.
     *
     *  Must either be the previous epoch or one before that.
     */
    public readonly votesEpoch: Epoch,
    /**
     * Votes coming from super majority of validators.
     *
     * NOTE: must be ordered by validator index.
     * https://graypaper.fluffylabs.dev/#/c71229b/121802121902
     *
     * TODO [ToDr] The Gray Paper does not seem to imply that this has to be
     * supermajority: https://graypaper.fluffylabs.dev/#/c71229b/123202123702 ?
     */
    public readonly votes: KnownSizeArray<Judgement, "Validators super majority">,
  ) {
    super();
  }
}

/**
 * A collection of judgements (votes over the validity of a [`WorkReport`]) formes a "verdict".
 * Together with offences (`culprits` & `faults`) - judgements and guarantees which dissent with an established
 * "verdict", these form the "disputes" system.
 *
 * `E_D = (v, c, f)`
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/115d01115d01
 */
export class DisputesExtrinsic extends WithDebug {
  static Codec = codec.Class(DisputesExtrinsic, {
    verdicts: codec.sequenceVarLen(Verdict.Codec),
    culprits: codec.sequenceVarLen(Culprit.Codec),
    faults: codec.sequenceVarLen(Fault.Codec),
  });

  static fromCodec({ verdicts, culprits, faults }: CodecRecord<DisputesExtrinsic>) {
    return new DisputesExtrinsic(verdicts, culprits, faults);
  }

  constructor(
    /**
     * `v`: a collection of verdicts over validity of some [`WorkReport`]s.
     *
     *  NOTE: must be ordered by report hash.
     *  https://graypaper.fluffylabs.dev/#/c71229b/12a50112a501
     */
    public readonly verdicts: Verdict[],
    /**
     * `c`: proofs of validator misbehavior: gauranteeing an invalid [`WorkReport`].
     *
     * NOTE: must be ordered by the validator's Ed25519Key.
     * https://graypaper.fluffylabs.dev/#/c71229b/12a50112a701
     */
    public readonly culprits: Culprit[],
    /**
     * `c`: proo of validator misbehavior: signing a contradictory judgement of a [`WorkReport`] validity.
     *
     * NOTE: must be ordered by the validator's Ed25519Key.
     * https://graypaper.fluffylabs.dev/#/c71229b/12a50112a701
     */
    public readonly faults: Fault[],
  ) {
    super();
  }
}
