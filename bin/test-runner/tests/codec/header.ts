import assert from "node:assert";
import fs from "node:fs";
import {
  type BandersnatchKey,
  type BandersnatchVrfSignature,
  type Ed25519Key,
  EpochMark,
  type ExtrinsicHash,
  Header,
  type HeaderHash,
  type TimeSlot,
  type ValidatorIndex,
} from "@typeberry/block";
import { TicketsMark } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import { bytes32, fromJson } from ".";

const bandersnatchVrfSignature = json.fromString((v) => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);

const epochMark = json.object<EpochMark>(
  {
    entropy: bytes32(),
    validators: json.array(bytes32<BandersnatchKey>()),
  },
  (x) => new EpochMark(x.entropy, x.validators),
);

const ticketsMark = json.object<TicketsMark>(
  {
    id: bytes32(),
    attempt: fromJson.ticketAttempt,
  },
  (x) => new TicketsMark(x.id, x.attempt),
);

type JsonHeader = {
  parent: HeaderHash;
  parent_state_root: TrieHash;
  extrinsic_hash: ExtrinsicHash;
  slot: TimeSlot;
  epoch_mark?: EpochMark;
  tickets_mark?: KnownSizeArray<TicketsMark, "EpochLength">;
  offenders_mark: Ed25519Key[];
  author_index: ValidatorIndex;
  entropy_source: BandersnatchVrfSignature;
  seal: BandersnatchVrfSignature;
};

export const headerFromJson = json.object<JsonHeader, Header>(
  {
    parent: bytes32(),
    parent_state_root: bytes32(),
    extrinsic_hash: bytes32(),
    slot: "number",
    epoch_mark: json.optional(epochMark),
    tickets_mark: json.optional<TicketsMark[]>(json.array(ticketsMark)),
    offenders_mark: json.array(bytes32<Ed25519Key>()),
    author_index: "number",
    entropy_source: bandersnatchVrfSignature,
    seal: bandersnatchVrfSignature,
  },
  ({
    parent,
    parent_state_root,
    extrinsic_hash,
    slot,
    epoch_mark,
    tickets_mark,
    offenders_mark,
    author_index,
    entropy_source,
    seal,
  }) => {
    const header = Header.empty();
    header.parentHash = parent;
    header.priorStateRoot = parent_state_root;
    header.extrinsicHash = extrinsic_hash;
    header.slot = slot;
    header.epochMark = epoch_mark ?? null;
    header.ticketsMark = tickets_mark ?? null;
    header.offendersMark = offenders_mark;
    header.authorIndex = author_index;
    header.entropySource = entropy_source;
    header.seal = seal;
    return header;
  },
);

export async function runHeaderTest(test: Header, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const decodedHeader = Decoder.decodeObject(Header.Codec, encoded);

  assert.deepStrictEqual(test, decodedHeader);
}
