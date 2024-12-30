import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, type DescribedBy, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { EST_EPOCH_LENGTH, EST_VALIDATORS } from "@typeberry/config";
import { HASH_SIZE, WithHash } from "@typeberry/hash";
import { WithDebug, asOpaqueType } from "@typeberry/utils";
import {
  type EntropyHash,
  type StateRootHash,
  type TimeSlot,
  type ValidatorIndex,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "./common";
import { withContext } from "./context";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  type BandersnatchKey,
  type BandersnatchVrfSignature,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "./crypto";
import type { ExtrinsicHash, HeaderHash } from "./hash";
import { Ticket } from "./tickets";

/**
 * For the first block in a new epoch, the epoch marker is set
 * and contains the epoch randomness and Bandersnatch keys
 * of validators for the NEXT epoch.
 *
 * https://graypaper.fluffylabs.dev/#/911af30/0e30030e6903
 */
export class EpochMarker extends WithDebug {
  static Codec = codec.Class(EpochMarker, {
    entropy: codec.bytes(HASH_SIZE).asOpaque(),
    ticketsEntropy: codec.bytes(HASH_SIZE).asOpaque(),
    validators: codec.select<EpochMarker["validators"]>(
      {
        name: "EpochMark.validators",
        sizeHint: { bytes: EST_VALIDATORS * BANDERSNATCH_KEY_BYTES, isExact: false },
      },
      withContext("EpochMark.validators", (context) => {
        return codec.sequenceFixLen(codec.bytes(BANDERSNATCH_KEY_BYTES), context.validatorsCount).convert(
          (i) => i,
          (o) => asOpaqueType(o.map((x): BandersnatchKey => asOpaqueType(x))),
        );
      }),
    ),
  });

  static fromCodec({ entropy, ticketsEntropy, validators }: CodecRecord<EpochMarker>) {
    return new EpochMarker(entropy, ticketsEntropy, validators);
  }

  public constructor(
    /** `eta_1'`: Randomness for the NEXT epoch. */
    public readonly entropy: EntropyHash,
    /** `eta_2'`: Randomness for the CURRENT epoch. */
    public readonly ticketsEntropy: EntropyHash,
    // TODO [ToDr] constrain the sequence length during decoding.
    /** `kappa_b`: Bandernsatch validator keys for the NEXT epoch. */
    public readonly validators: KnownSizeArray<BandersnatchKey, "ValidatorsCount">,
  ) {
    super();
  }
}

/**
 * The header of the JAM block.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c48000c5400
 */
export class Header extends WithDebug {
  static Codec = codec.Class(Header, {
    parentHeaderHash: codec.bytes(HASH_SIZE).asOpaque(),
    priorStateRoot: codec.bytes(HASH_SIZE).asOpaque(),
    extrinsicHash: codec.bytes(HASH_SIZE).asOpaque(),
    timeSlotIndex: codec.u32.asOpaque(),
    epochMarker: codec.optional(EpochMarker.Codec),
    ticketsMarker: codec.optional(
      codec.select<KnownSizeArray<Ticket, "EpochLength">>(
        {
          name: "Header.ticketsMark",
          sizeHint: { bytes: EST_EPOCH_LENGTH * Ticket.Codec.sizeHint.bytes, isExact: false },
        },
        withContext("Header.ticketsMark", (context) => {
          return codec.sequenceFixLen(Ticket.Codec, context.epochLength).asOpaque();
        }),
      ),
    ),
    offendersMarker: codec.sequenceVarLen(codec.bytes(ED25519_KEY_BYTES).asOpaque()),
    bandersnatchBlockAuthorIndex: codec.u16.asOpaque(),
    entropySource: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque(),
    seal: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque(),
  });

  static fromCodec(h: CodecRecord<Header>) {
    return Object.assign(Header.empty(), h);
  }

  /**
   * `H_p`: Hash of the parent header.
   *
   * In case of the genesis block, the hash will be zero.
   */
  public parentHeaderHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();
  /** `H_r`: The state trie root hash before executing that block. */
  public priorStateRoot: StateRootHash = Bytes.zero(HASH_SIZE).asOpaque();
  /** `H_x`: The hash of block extrinsic. */
  public extrinsicHash: ExtrinsicHash = Bytes.zero(HASH_SIZE).asOpaque();
  /** `H_t`: JAM time-slot index. */
  public timeSlotIndex: TimeSlot = tryAsTimeSlot(0);
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
  public bandersnatchBlockAuthorIndex: ValidatorIndex = tryAsValidatorIndex(0);
  /** `H_v`: Entropy-yielding VRF signature. */
  public entropySource: BandersnatchVrfSignature = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque();
  /**
   * `H_s`: Block seal.
   *
   * https://graypaper.fluffylabs.dev/#/387103d/0de8000dee00
   */
  public seal: BandersnatchVrfSignature = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque();

  private constructor() {
    super();
  }

  /** Create an empty header with some dummy values. */
  public static empty() {
    return new Header();
  }
}

/** Undecoded View of the [`Header`]. */
export type HeaderView = DescribedBy<typeof Header.Codec.View>;

/**
 *  A codec-aware header with hash.
 *
 * TODO [ToDr] It seems that it's impossible to create a codec for generic class.
 * The typescript type system really needs concrete objects to resolve the types:
 * `DescriptorRecord` or `CodecRecord` for some reason.
 */
class HeaderWithHash extends WithHash<HeaderHash, Header> {
  static Codec = codec.Class(HeaderWithHash, {
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    data: Header.Codec,
  });

  static fromCodec({ hash, data }: CodecRecord<HeaderWithHash>) {
    return new WithHash(hash, data);
  }
}
/** Encoding of header + hash. */
export const headerWithHashCodec = HeaderWithHash.Codec;
