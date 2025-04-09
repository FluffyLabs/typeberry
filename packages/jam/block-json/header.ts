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
} from "@typeberry/block";
import { Ticket } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { json, parseFromJson } from "@typeberry/json-parser";
import { fromJson } from "./common";

const bandersnatchVrfSignature = json.fromString((v) => Bytes.parseBytes(v, 96) as BandersnatchVrfSignature);

type JsonEpochMarker = {
  entropy: EntropyHash;
  tickets_entropy: EntropyHash;
  validators: PerValidator<BandersnatchKey>;
};

// TODO [ToDr] Temporary fix for old test vectors we have.
// i.e. previously epoch mark only had `BandersnatchKey`,
// now it's also `Ed25519Key`. I want to load jamduna test vectors
// for tests and need that.
class ValidatorData {
  constructor(
    public readonly bandersnatch: BandersnatchKey,
    public readonly ed25519: Ed25519Key,
  ) {}
}

const epochMarkValidatorDataFromJson = json.fromAny<BandersnatchKey>((x, context) => {
  if (typeof x === "string") {
    return parseFromJson(x, fromJson.bytes32(), context);
  }
  return parseFromJson(
    x,
    json.object<ValidatorData, BandersnatchKey>(
      {
        bandersnatch: fromJson.bytes32(),
        ed25519: fromJson.bytes32(),
      },
      ({ bandersnatch }) => bandersnatch,
    ),
  );
});

const epochMark = json.object<JsonEpochMarker, EpochMarker>(
  {
    entropy: fromJson.bytes32(),
    tickets_entropy: fromJson.bytes32(),
    validators: json.array(epochMarkValidatorDataFromJson),
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
