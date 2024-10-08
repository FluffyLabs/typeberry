import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { U16, U32 } from "@typeberry/numbers";
import type { EntropyHash } from "@typeberry/safrole";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import type { BandersnatchKey, BandersnatchVrfSignature, Ed25519Key } from "./crypto";
import { type ExtrinsicHash, HASH_SIZE, type HeaderHash } from "./hash";
import { TicketsMark } from "./tickets";

export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;

export class EpochMark {
  static Codec = codec.Class(EpochMark, {
    entropy: codec.bytes(HASH_SIZE).cast(),
    validators: codec.sequenceVarLen(codec.bytes(32)).cast(),
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
    ticketsMark: codec.optional(codec.sequenceVarLen(TicketsMark.Codec).cast()),
    offendersMark: codec.optional(codec.sequenceVarLen(codec.bytes(32).cast())),
    authorIndex: codec.u16.cast(),
    entropySource: codec.bytes(96).cast(),
    seal: codec.bytes(96).cast(),
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
  public offendersMark: Ed25519Key[] | null = null;
  public authorIndex: ValidatorIndex = 0 as ValidatorIndex;
  public entropySource: BandersnatchVrfSignature = Bytes.zero(96) as BandersnatchVrfSignature;
  public seal: BandersnatchVrfSignature = Bytes.zero(96) as BandersnatchVrfSignature;

  public static empty() {
    return new Header();
  }
}
