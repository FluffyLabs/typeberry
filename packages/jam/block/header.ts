import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, type DescribedBy } from "@typeberry/codec";
import { BANDERSNATCH_KEY_BYTES, type BandersnatchKey, ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES, type BandersnatchVrfSignature } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE, WithHash } from "@typeberry/hash";
import { Compatibility, GpVersion, WithDebug } from "@typeberry/utils";
import {
  codecPerEpochBlock,
  codecPerValidator,
  type EntropyHash,
  type PerEpochBlock,
  type PerValidator,
  type StateRootHash,
  type TimeSlot,
  tryAsTimeSlot,
  tryAsValidatorIndex,
  type ValidatorIndex,
} from "./common.js";
import type { ExtrinsicHash, HeaderHash } from "./hash.js";
import { Ticket } from "./tickets.js";

/**
 * Encoded validator keys.
 * https://graypaper.fluffylabs.dev/#/68eaa1f/0e34030e3603?v=0.6.4
 */
export class ValidatorKeys extends WithDebug {
  static Codec = codec.Class(ValidatorKeys, {
    bandersnatch: codec.bytes(BANDERSNATCH_KEY_BYTES).asOpaque<BandersnatchKey>(),
    ed25519: codec.bytes(ED25519_KEY_BYTES).asOpaque<Ed25519Key>(),
  });

  static create({ bandersnatch, ed25519 }: CodecRecord<ValidatorKeys>) {
    return new ValidatorKeys(bandersnatch, ed25519);
  }

  private constructor(
    /** `kappa_b`: Bandersnatch validator keys for the NEXT epoch. */
    public readonly bandersnatch: BandersnatchKey,
    /** `kappa_e`: Ed25519 validator keys for the NEXT epoch. */
    public readonly ed25519: Ed25519Key,
  ) {
    super();
  }
}

export class TicketsMarker extends WithDebug {
  static Codec = codec.Class(TicketsMarker, {
    tickets: codecPerEpochBlock(Ticket.Codec),
  });

  static create({ tickets }: CodecRecord<TicketsMarker>) {
    return new TicketsMarker(tickets);
  }

  private constructor(public readonly tickets: PerEpochBlock<Ticket>) {
    super();
  }
}

export type TicketsMarkerView = DescribedBy<typeof TicketsMarker.Codec.View>;

/**
 * For the first block in a new epoch, the epoch marker is set
 * and contains the epoch randomness and validator keys
 * for the NEXT epoch.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0e30030e6603
 */
export class EpochMarker extends WithDebug {
  static Codec = codec.Class(EpochMarker, {
    entropy: codec.bytes(HASH_SIZE).asOpaque<EntropyHash>(),
    ticketsEntropy: codec.bytes(HASH_SIZE).asOpaque<EntropyHash>(),
    validators: codecPerValidator(ValidatorKeys.Codec),
  });

  static create({ entropy, ticketsEntropy, validators }: CodecRecord<EpochMarker>) {
    return new EpochMarker(entropy, ticketsEntropy, validators);
  }

  private constructor(
    /** `eta_1'`: Randomness for the NEXT epoch. */
    public readonly entropy: EntropyHash,
    /** `eta_2'`: Randomness for the CURRENT epoch. */
    public readonly ticketsEntropy: EntropyHash,
    /** `kappa_b`: Bandersnatch validator keys for the NEXT epoch. */
    public readonly validators: PerValidator<ValidatorKeys>,
  ) {
    super();
  }
}

export type EpochMarkerView = DescribedBy<typeof EpochMarker.Codec.View>;

/**
 * Return an encoded header without the seal components.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/370202370302?v=0.6.4
 */
export const encodeUnsealedHeader = (view: HeaderView): BytesBlob => {
  // we basically need to omit the last field, perhaps there is better
  // way to do that, but this seems like the most straightforward
  const encodedFullHeader = view.encoded().raw;
  const encodedUnsealedLen = encodedFullHeader.length - BANDERSNATCH_VRF_SIGNATURE_BYTES;
  return BytesBlob.blobFrom(encodedFullHeader.subarray(0, encodedUnsealedLen));
};

/**
 * Codec descriptor with pre 0.7.0 encoding order
 */
const legacyDescriptor = {
  parentHeaderHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
  priorStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
  extrinsicHash: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
  timeSlotIndex: codec.u32.asOpaque<TimeSlot>(),
  epochMarker: codec.optional(EpochMarker.Codec),
  ticketsMarker: codec.optional(TicketsMarker.Codec),
  offendersMarker: codec.sequenceVarLen(codec.bytes(ED25519_KEY_BYTES).asOpaque<Ed25519Key>()),
  bandersnatchBlockAuthorIndex: codec.u16.asOpaque<ValidatorIndex>(),
  entropySource: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque<BandersnatchVrfSignature>(),
  seal: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque<BandersnatchVrfSignature>(),
};

/**
 * The header of the JAM block.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0c66000c7200
 */
export class Header extends WithDebug {
  static Codec = codec.Class(
    Header,
    Compatibility.isLessThan(GpVersion.V0_7_0)
      ? legacyDescriptor
      : {
          parentHeaderHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
          priorStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
          extrinsicHash: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
          timeSlotIndex: codec.u32.asOpaque<TimeSlot>(),
          epochMarker: codec.optional(EpochMarker.Codec),
          ticketsMarker: codec.optional(TicketsMarker.Codec),
          bandersnatchBlockAuthorIndex: codec.u16.asOpaque<ValidatorIndex>(),
          entropySource: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque<BandersnatchVrfSignature>(),
          offendersMarker: codec.sequenceVarLen(codec.bytes(ED25519_KEY_BYTES).asOpaque<Ed25519Key>()),
          seal: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque<BandersnatchVrfSignature>(),
        },
  );

  static create(h: CodecRecord<Header>) {
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
  public ticketsMarker: TicketsMarker | null = null;
  /** `H_i`: Block author's index in the current validator set. */
  public bandersnatchBlockAuthorIndex: ValidatorIndex = tryAsValidatorIndex(0);
  /** `H_v`: Entropy-yielding VRF signature. */
  public entropySource: BandersnatchVrfSignature = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque();
  /** `H_o`: Sequence of keys of newly misbehaving validators. */
  public offendersMarker: Ed25519Key[] = [];
  /**
   * `H_s`: Block seal.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/0d0c010d1101
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
class HeaderViewWithHash extends WithHash<HeaderHash, HeaderView> {
  static Codec = codec.Class(HeaderViewWithHash, {
    hash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    data: Header.Codec.View,
  });

  static create({ hash, data }: CodecRecord<HeaderViewWithHash>) {
    return new WithHash(hash, data);
  }
}
/** Encoding of header + hash. */
export const headerViewWithHashCodec = HeaderViewWithHash.Codec;
