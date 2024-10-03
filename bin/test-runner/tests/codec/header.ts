import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import type { EntropyHash, TicketAttempt } from "@typeberry/safrole";
import type { BandersnatchKey, Ed25519Key } from "@typeberry/safrole/crypto";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import { type HeaderHash, type Slot, type ValidatorIndex, bytes32, fromJson, logger } from ".";

type BandersnatchVrfSignature = Opaque<Bytes<96>, "BandersnatchVrfSignature">;
const bandersnatchVrfSignatureFromString = json.fromString((v) => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);

class EpochMark {
  static fromJson: FromJson<EpochMark> = {
    entropy: bytes32(),
    validators: json.array(bytes32<BandersnatchKey>()),
  };

  entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

class TicketsMark {
  static fromJson: FromJson<TicketsMark> = {
    id: bytes32<Bytes<32>>(),
    attempt: fromJson.ticketAttempt,
  };

  id!: Bytes<32>;
  attempt!: TicketAttempt;

  private constructor() {}
}

export class Header {
  static fromJson: FromJson<Header> = {
    parent: bytes32(),
    parent_state_root: bytes32(),
    extrinsic_hash: bytes32(),
    slot: json.castNumber(),
    epoch_mark: json.optional(EpochMark.fromJson),
    tickets_mark: json.optional<TicketsMark[]>(json.array(TicketsMark.fromJson)),
    offenders_mark: json.array(bytes32<Ed25519Key>()),
    author_index: json.castNumber(),
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

  private constructor() {}
}

export async function runHeaderTest(test: Header, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
