import {Bytes} from "@typeberry/bytes";
import {KnownSizeArray} from "@typeberry/collections";
import {U16, U32} from "@typeberry/numbers";
import {TrieHash} from "@typeberry/trie";
import {Opaque} from "@typeberry/utils";
import {BandersnatchKey, BandersnatchVrfSignature, Ed25519Key} from "./crypto";
import {EntropyHash, TicketAttempt} from "@typeberry/safrole";
import {ExtrinsicHash, HASH_SIZE, HeaderHash} from "./hash";
import {codec, type Record } from "@typeberry/codec";

export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;

export class EpochMark {
  static Codec = codec.Class(EpochMark, {
    entropy: codec.bytes(32).cast(),
    validators: codec.sequenceVarLen(codec.bytes(32)).cast()
  });

  static fromCodec({ entropy, validators }: Record<EpochMark>) {
    return new EpochMark(entropy, validators);
  }

  public constructor(
    public entropy: EntropyHash,
    public validators: KnownSizeArray<BandersnatchKey, "ValidatorsCount">,
  ) {

  }
}

export class TicketsMark {
  static Codec = codec.Class(TicketsMark, {
    id: codec.bytes(32),
    attempt: codec.u8.convert(i => i, o => {
      if (o === 0 || o === 1) {
        return o as TicketAttempt;
      }
      throw new Error(`Unexpected TickAttempt value in codec: ${o}`);
    }),
  });

  static fromCodec({ id, attempt }: Record<TicketsMark>) {
    return new TicketsMark(id, attempt);
  }

  public constructor(
    public id: Bytes<32>,
    public attempt: TicketAttempt,
  ) {}
}

export class Header {
  static Codec = codec.Class(Header, {
    parentHash: codec.bytes(32).cast(),
    priorStateRoot: codec.bytes(32).cast(),
    extrinsicHash: codec.bytes(32).cast(),
    slot: codec.u32.cast(),
    epochMark: codec.optional(EpochMark.Codec),
    ticketsMark: codec.optional(codec.sequenceVarLen(TicketsMark.Codec).cast()),
    offendersMark: codec.optional(codec.sequenceVarLen(codec.bytes(32).cast())),
    authorIndex: codec.u16.cast(),
    entropySource: codec.bytes(96).cast(),
    seal: codec.bytes(96).cast(),
  });

  static fromCodec(h: Record<Header>) {
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
