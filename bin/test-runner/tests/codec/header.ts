import { Bytes } from "@typeberry/bytes";
import { OPTIONAL, ARRAY, FROM_STRING, type FromJson, FROM_NUMBER } from "../../json-parser";
import {BandersnatchKey, Ed25519Key} from "@typeberry/safrole/crypto";
import {EntropyHash} from "@typeberry/safrole";
import {TrieHash} from "@typeberry/trie";
import {Opaque} from "@typeberry/utils";
import {HeaderHash, logger, Slot, ValidatorIndex} from ".";

const bytes32 = <T extends Bytes<32>>() => FROM_STRING((v) => Bytes.parseBytes(v, 32) as T);

const bandersnatchVrfSignatureFromString = FROM_STRING(v => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);
type BandersnatchVrfSignature = Opaque<Bytes<96>, "BandersnatchVrfSignature">;

class EpochMark {
  static fromJson: FromJson<EpochMark> = {
    entropy: bytes32<EntropyHash>(),
    validators: ARRAY(bytes32<BandersnatchKey>())
  };

  entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

class TicketsMark {
  static fromJson: FromJson<TicketsMark> = {
    id: bytes32<Bytes<32>>(),
    attempt: 'number',
  };
  id!: Bytes<32>;
  attempt!: 0 | 1;
}

export class Header {
  static fromJson: FromJson<Header> = {
    parent: bytes32<HeaderHash>(),
    parent_state_root: bytes32<TrieHash>(),
    extrinsic_hash: bytes32<Bytes<32>>(),
    slot: FROM_NUMBER(n => n as Slot),
    epoch_mark: OPTIONAL(EpochMark.fromJson),
    tickets_mark: OPTIONAL<TicketsMark[]>(ARRAY(TicketsMark.fromJson)),
    offenders_mark: ARRAY(bytes32<Ed25519Key>()),
    author_index: FROM_NUMBER(n => n as ValidatorIndex),
    entropy_source: bandersnatchVrfSignatureFromString,
    seal: bandersnatchVrfSignatureFromString,
  };

  parent!: HeaderHash;
  parent_state_root!: TrieHash;
  extrinsic_hash!: Bytes<32>;
  slot!: Slot;
  epoch_mark?: EpochMark;
  tickets_mark?: TicketsMark[];
  offenders_mark?: Ed25519Key[];
  author_index!: ValidatorIndex;
  entropy_source!: BandersnatchVrfSignature;
  seal!: BandersnatchVrfSignature;
}

export async function runHeaderTest(test: Header, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}

