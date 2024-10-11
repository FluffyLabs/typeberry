import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { TrieHash } from "@typeberry/trie";
import type { EntropyHash, TimeSlot, ValidatorIndex } from "./common";
import { ChainSpec, EST_EPOCH_LENGTH, EST_VALIDATORS } from "./context";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  type BandersnatchKey,
  type BandersnatchVrfSignature,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "./crypto";
import { type ExtrinsicHash, HASH_SIZE, type HeaderHash } from "./hash";
import { Ticket } from "./tickets";

/**
 * For the first block in a new epoch, the epoch marker is set
 * and contains the epoch randomness and Bandersnatch keys
 * of validators for the NEXT epoch.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0e1f020e2502
 */
export class EpochMarker {
  static Codec = codec.Class(EpochMarker, {
    entropy: codec.bytes(HASH_SIZE).cast(),
    validators: codec.select(
      {
        name: "EpochMark.validators",
        sizeHintBytes: EST_VALIDATORS * BANDERSNATCH_KEY_BYTES,
      },
      (context) => {
        if (context instanceof ChainSpec) {
          return codec.sequenceFixLen(codec.bytes(BANDERSNATCH_KEY_BYTES), context.validatorsCount).cast();
        }
        throw new Error("Missing context object to decode `EpochMark.validators`.");
      },
    ),
  });

  static fromCodec({ entropy, validators }: CodecRecord<EpochMarker>) {
    return new EpochMarker(entropy, validators);
  }

  public constructor(
    /** `eta_1'`: Randomness for the NEXT epoch. */
    public readonly entropy: EntropyHash,
    /** `kappa_b`: Bandernsatch validator keys for the NEXT epoch. */
    public readonly validators: KnownSizeArray<BandersnatchKey, "ValidatorsCount">,
  ) {}
}

/**
 * The header of the JAM block.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c48000c5400
 */
export class Header {
  static Codec = codec.Class(Header, {
    parentHeaderHash: codec.bytes(HASH_SIZE).cast(),
    priorStateRoot: codec.bytes(HASH_SIZE).cast(),
    extrinsicHash: codec.bytes(HASH_SIZE).cast(),
    timeSlotIndex: codec.u32.cast(),
    epochMarker: codec.optional(EpochMarker.Codec),
    ticketsMarker: codec.optional(
      codec.select(
        {
          name: "Header.ticketsMark",
          sizeHintBytes: EST_EPOCH_LENGTH * Ticket.Codec.sizeHintBytes,
        },
        (context) => {
          if (context instanceof ChainSpec) {
            return codec.sequenceFixLen(Ticket.Codec, context.epochLength).cast();
          }
          throw new Error("Missing context object to decode `Header.ticketsMark`.");
        },
      ),
    ),
    offendersMarker: codec.sequenceVarLen(codec.bytes(ED25519_KEY_BYTES).cast()),
    bandersnatchBlockAuthorIndex: codec.u16.cast(),
    entropySource: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).cast(),
    seal: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).cast(),
  });

  static fromCodec(h: CodecRecord<Header>) {
    return Object.assign(Header.empty(), h);
  }

  /**
   * `H_p`: Hash of the parent header.
   *
   * In case of the genesis block, the hash will be zero.
   */
  public parentHeaderHash: HeaderHash = Bytes.zero(HASH_SIZE) as HeaderHash;
  /** `H_r`: The state trie root hash before executing that block. */
  public priorStateRoot: TrieHash = Bytes.zero(HASH_SIZE) as TrieHash;
  /** `H_x`: The hash of block extrinsic. */
  public extrinsicHash: ExtrinsicHash = Bytes.zero(HASH_SIZE) as ExtrinsicHash;
  /** `H_t`: JAM time-slot index. */
  public timeSlotIndex: TimeSlot = 0 as TimeSlot;
  /**
   * `H_e`: Key and entropy relevant to the following epoch in case the ticket
   *        contest does not complete adequately.
   */
  public epochMarker: EpochMarker | null = null;
  /**
   * `H_w`: Winning tickets provides the series of 600 slot sealing "tickets"
   *        for the next epoch.
   */
  public ticketsMarker: KnownSizeArray<Ticket, "EpochLength"> | null = null;
  /** `H_o`: Sequence of keys of newly misbehaving validators. */
  public offendersMarker: Ed25519Key[] = [];
  /** `H_i`: Block author's index in the current validator set. */
  public bandersnatchBlockAuthorIndex: ValidatorIndex = 0 as ValidatorIndex;
  /** `H_v`: Entropy-yielding VRF signature. */
  public entropySource: BandersnatchVrfSignature = Bytes.zero(
    BANDERSNATCH_VRF_SIGNATURE_BYTES,
  ) as BandersnatchVrfSignature;
  /**
   * `H_s`: Block seal.
   *
   * https://graypaper.fluffylabs.dev/#/387103d/0de8000dee00
   */
  public seal: BandersnatchVrfSignature = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES) as BandersnatchVrfSignature;

  /** Create an empty header with some dummy values. */
  public static empty() {
    return new Header();
  }
}
