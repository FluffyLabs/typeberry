import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { bytes32, fromJson as rootFromJson, logger } from ".";
import {BandersnatchKey, BandersnatchVrfSignature, Ed25519Key, EpochMark, ExtrinsicHash, Header, HeaderHash, TicketsMark, TimeSlot, ValidatorIndex} from "@typeberry/block";
import {KnownSizeArray} from "@typeberry/collections";
import {TrieHash} from "@typeberry/trie";

export namespace fromJson {
  export const bandersnatchVrfSignature = json.fromString((v) => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);

  export const epochMark = json.object<EpochMark>(
    {
      entropy: bytes32(),
      validators: json.array(bytes32<BandersnatchKey>()),
    },
    (x) => new EpochMark(x.entropy, x.validators),
  );

  export const ticketsMark = json.object<TicketsMark>(
    {
      id: bytes32(),
      attempt: rootFromJson.ticketAttempt,
    },
    (x) => new TicketsMark(x.id, x.attempt),
  );

  export type JsonHeader = {
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

  export const header = json.object<JsonHeader, Header>({
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
  ({ parent, parent_state_root, extrinsic_hash, slot, epoch_mark, tickets_mark, offenders_mark, author_index, entropy_source, seal }) => {
    const header = Header.empty();
    header.parentHash = parent;
    header.parentStateRoot = parent_state_root;
    header.extrinsicHash = extrinsic_hash;
    header.slot = slot;
    header.epochMark = epoch_mark;
    header.ticketsMark = tickets_mark;
    header.offendersMark = offenders_mark;
    header.authorIndex = author_index;
    header.entropySource = entropy_source;
    header.seal = seal;
    return header;
  });
}

export async function runHeaderTest(test: Header, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
