import {Bytes} from "@typeberry/bytes";
import {KnownSizeArray} from "@typeberry/collections";
import {U16, U32} from "@typeberry/numbers";
import {TrieHash} from "@typeberry/trie";
import {Opaque} from "@typeberry/utils";
import {BandersnatchKey, BandersnatchVrfSignature, Ed25519Key} from "./crypto";
import {EntropyHash, TicketAttempt} from "@typeberry/safrole";
import {ExtrinsicHash, HASH_SIZE, HeaderHash} from "./hash";

export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;

export class Header {
  public parentHash: HeaderHash = Bytes.zero(HASH_SIZE) as HeaderHash;
  public parentStateRoot: TrieHash = Bytes.zero(HASH_SIZE) as TrieHash;
  public extrinsicHash: ExtrinsicHash = Bytes.zero(HASH_SIZE) as ExtrinsicHash;
  public slot: TimeSlot = 0 as TimeSlot;
  public epochMark?: EpochMark;
  public ticketsMark?: KnownSizeArray<TicketsMark, "EpochLength">;
  public offendersMark?: Ed25519Key[];
  public authorIndex: ValidatorIndex = 0 as ValidatorIndex;
  public entropySource: BandersnatchVrfSignature = Bytes.zero(96) as BandersnatchVrfSignature;
  public seal: BandersnatchVrfSignature = Bytes.zero(96) as BandersnatchVrfSignature;

  public static empty() {
    return new Header();
  }
}

export class EpochMark {
  public constructor(
    public entropy: EntropyHash,
    public validators: KnownSizeArray<BandersnatchKey, "ValidatorsCount">,
  ) {}
}

export class TicketsMark {
  public constructor(
    public id: Bytes<32>,
    public attempt: TicketAttempt,
  ) {}
}

