import {
  type BandersnatchKey,
  type BandersnatchVrfSignature,
  type Ed25519Key,
  type EntropyHash,
  EpochMarker,
  type ExtrinsicHash,
  Header,
  type HeaderHash,
  type PerValidator,
  type StateRootHash,
  type TimeSlot,
  type ValidatorIndex,
  ValidatorKeys,
} from "@typeberry/block";
import { Ticket } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from "./common";

const bandersnatchVrfSignature = json.fromString((v) => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);

type JsonValidatorKeys = {
  bandersnatchKey: BandersnatchKey;
  ed25519Key: Ed25519Key;
};

const validatorKeys = json.object<JsonValidatorKeys, ValidatorKeys>(
  {
    bandersnatchKey: fromJson.bytes32<BandersnatchKey>(),
    ed25519Key: fromJson.bytes32<Ed25519Key>(),
  },
  (x) => new ValidatorKeys(x.bandersnatchKey, x.ed25519Key),
);

type JsonEpochMarker = {
  entropy: EntropyHash;
  tickets_entropy: EntropyHash;
  validators: PerValidator<ValidatorKeys>;
};

const epochMark = json.object<JsonEpochMarker, EpochMarker>(
  {
    entropy: fromJson.bytes32(),
    tickets_entropy: fromJson.bytes32(),
    validators: json.array(validatorKeys),
  },
  (x) => new EpochMarker(x.entropy, x.tickets_entropy, x.validators),
);

const ticketsMark = json.object<Ticket>(
  {
    id: fromJson.bytes32(),
    attempt: fromJson.ticketAttempt,
  },
  (x) => new Ticket(x.id, x.attempt),
);

type JsonHeader = {
  parent: HeaderHash;
  parent_state_root: StateRootHash;
  extrinsic_hash: ExtrinsicHash;
  slot: TimeSlot;
  epoch_mark?: EpochMarker;
  tickets_mark?: KnownSizeArray<Ticket, "EpochLength">;
  offenders_mark: Ed25519Key[];
  author_index: ValidatorIndex;
  entropy_source: BandersnatchVrfSignature;
  seal: BandersnatchVrfSignature;
};

export const headerFromJson = json.object<JsonHeader, Header>(
  {
    parent: fromJson.bytes32(),
    parent_state_root: fromJson.bytes32(),
    extrinsic_hash: fromJson.bytes32(),
    slot: "number",
    epoch_mark: json.optional(epochMark),
    tickets_mark: json.optional<Ticket[]>(json.array(ticketsMark)),
    offenders_mark: json.array(fromJson.bytes32<Ed25519Key>()),
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
    header.parentHeaderHash = parent;
    header.priorStateRoot = parent_state_root;
    header.extrinsicHash = extrinsic_hash;
    header.timeSlotIndex = slot;
    header.epochMarker = epoch_mark ?? null;
    header.ticketsMarker = tickets_mark ?? null;
    header.offendersMarker = offenders_mark;
    header.bandersnatchBlockAuthorIndex = author_index;
    header.entropySource = entropy_source;
    header.seal = seal;
    return header;
  },
);

export async function runHeaderTest(test: Header, file: string) {
  runCodecTest(Header.Codec, test, file);
}
