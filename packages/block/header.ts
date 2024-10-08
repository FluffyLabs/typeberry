import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { U16, U32 } from "@typeberry/numbers";
import type { EntropyHash } from "@typeberry/safrole";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import { CodecContext, EST_EPOCH_LENGTH, EST_VALIDATORS } from "./context";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  type BandersnatchKey,
  type BandersnatchVrfSignature,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "./crypto";
import { type ExtrinsicHash, HASH_SIZE, type HeaderHash } from "./hash";
import { TicketsMark } from "./tickets";

export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;

export class EpochMark {
  static Codec = codec.Class(EpochMark, {
    entropy: codec.bytes(HASH_SIZE).cast(),
    validators: codec.select(
      {
        name: "EpochMark.validators",
        sizeHintBytes: EST_VALIDATORS * BANDERSNATCH_KEY_BYTES,
      },
      (context) => {
        if (context instanceof CodecContext) {
          return codec.sequenceFixLen(codec.bytes(BANDERSNATCH_KEY_BYTES), context.validatorsCount).cast();
        }
        throw new Error("Missing context object to decode `EpochMark.validators`.");
      },
    ),
  });

  static fromCodec({ entropy, validators }: CodecRecord<EpochMark>) {
    return new EpochMark(entropy, validators);
  }

  public constructor(
    public readonly entropy: EntropyHash,
    public readonly validators: KnownSizeArray<BandersnatchKey, "ValidatorsCount">,
  ) {}
}

export class Header {
  static Codec = codec.Class(Header, {
    parentHash: codec.bytes(HASH_SIZE).cast(),
    priorStateRoot: codec.bytes(HASH_SIZE).cast(),
    extrinsicHash: codec.bytes(HASH_SIZE).cast(),
    slot: codec.u32.cast(),
    epochMark: codec.optional(EpochMark.Codec),
    ticketsMark: codec.optional(
      codec.select(
        {
          name: "Header.ticketsMark",
          sizeHintBytes: EST_EPOCH_LENGTH * TicketsMark.Codec.sizeHintBytes,
        },
        (context) => {
          if (context instanceof CodecContext) {
            return codec.sequenceFixLen(TicketsMark.Codec, context.epochLength).cast();
          }
          throw new Error("Missing context object to decode `Header.ticketsMark`.");
        },
      ),
    ),
    offendersMark: codec.sequenceVarLen(codec.bytes(ED25519_KEY_BYTES).cast()),
    authorIndex: codec.u16.cast(),
    entropySource: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).cast(),
    seal: codec.bytes(BANDERSNATCH_VRF_SIGNATURE_BYTES).cast(),
  });

  static fromCodec(h: CodecRecord<Header>) {
    return Object.assign(Header.empty(), h);
  }

  public parentHash: HeaderHash = Bytes.zero(HASH_SIZE) as HeaderHash;
  public priorStateRoot: TrieHash = Bytes.zero(HASH_SIZE) as TrieHash;
  public extrinsicHash: ExtrinsicHash = Bytes.zero(HASH_SIZE) as ExtrinsicHash;
  public slot: TimeSlot = 0 as TimeSlot;
  public epochMark: EpochMark | null = null;
  public ticketsMark: KnownSizeArray<TicketsMark, "EpochLength"> | null = null;
  public offendersMark: Ed25519Key[] = [];
  public authorIndex: ValidatorIndex = 0 as ValidatorIndex;
  public entropySource: BandersnatchVrfSignature = Bytes.zero(
    BANDERSNATCH_VRF_SIGNATURE_BYTES,
  ) as BandersnatchVrfSignature;
  public seal: BandersnatchVrfSignature = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES) as BandersnatchVrfSignature;

  public static empty() {
    return new Header();
  }
}
