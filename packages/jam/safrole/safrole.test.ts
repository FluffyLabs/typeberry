import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  type EntropyHash,
  EpochMarker,
  type PerEpochBlock,
  type PerValidator,
  reencodeAsView,
  TicketsMarker,
  tryAsPerEpochBlock,
  tryAsTimeSlot,
  ValidatorKeys,
} from "@typeberry/block";
import { type SignedTicket, Ticket, type TicketsExtrinsic, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, SortedSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { BANDERSNATCH_PROOF_BYTES, BANDERSNATCH_RING_ROOT_BYTES } from "@typeberry/crypto/bandersnatch.js";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { hashComparator, VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { type SafroleSealingKeys, SafroleSealingKeysKind } from "@typeberry/state/safrole-data.js";
import { deepEqual, Result } from "@typeberry/utils";
import bandersnatchVrf from "./bandersnatch-vrf.js";
import { BandernsatchWasm } from "./bandersnatch-wasm.js";
import { type Input, Safrole, SafroleErrorCode, type SafroleState, type SafroleStateUpdate } from "./safrole.js";

const bwasm = BandernsatchWasm.new();

const validators: PerValidator<ValidatorData> = asKnownSize(
  [
    {
      bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
      ed25519: "0x837ce344bc9defceb0d7de7e9e9925096768b7adb4dad932e532eb6551e0ea02",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
      ed25519: "0xb3e0e096b02e2ec98a3441410aeddd78c95e27a0da6f411a09c631c0f2bea6e9",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
      ed25519: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
      ed25519: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
      ed25519: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
      ed25519: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
      bls: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      metadata:
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
  ].map(({ bandersnatch, bls, ed25519, metadata }) =>
    ValidatorData.create({
      bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
      bls: Bytes.parseBytes(bls, BLS_KEY_BYTES).asOpaque(),
      ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
      metadata: Bytes.parseBytes(metadata, VALIDATOR_META_BYTES).asOpaque(),
    }),
  ),
);

const fakeSealingKeys: SafroleSealingKeys = {
  kind: SafroleSealingKeysKind.Keys,
  // cheating here a bit since it's unused
  keys: asKnownSize([]),
};

describe("Safrole", () => {
  let blake2b: Blake2b;

  beforeEach(async () => {
    mock.method(bandersnatchVrf, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
        { isValid: true, entropyHash: Bytes.fill(HASH_SIZE, 1) },
      ]),
    );
    blake2b = await Blake2b.createHasher();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should return incorrect timeslot error", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(0);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);
    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadSlot);
    }
  });

  it("should return unexpected ticket because of incorrect length of extrinsic", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: SignedTicket[] = [];
    extrinsic.length = tinyChainSpec.epochLength + 1;
    const input = {
      slot: timeslot,
      entropy,
      extrinsic: asKnownSize(extrinsic),
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.UnexpectedTicket);
    }
  });

  it("should return bad ticket attempt because of incorrect ticket attempt", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: tryAsTicketAttempt(tinyChainSpec.ticketsPerValidator + 2),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketAttempt);
    }
  });

  it("should return bad ticket proof error", async () => {
    mock.method(bandersnatchVrf, "verifyTickets", () =>
      Promise.resolve([{ isValid: false, entropyHash: Bytes.zero(HASH_SIZE) }]),
    );
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketProof);
    }
  });

  it("should return duplicated ticket error", async () => {
    mock.method(bandersnatchVrf, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
      ]),
    );
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.DuplicateTicket);
    }
  });

  it("should return bad ticket order error", async () => {
    mock.method(bandersnatchVrf, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.fill(HASH_SIZE, 1) },
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
      ]),
    );
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.fill(BANDERSNATCH_PROOF_BYTES, 1).asOpaque(),
      },
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketOrder);
    }
  });

  it("should return correctly sequenced sealingKeySeries", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      // end of epoch
      timeslot: tryAsTimeSlot(9),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 1),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 2),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 3),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 4),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 5),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 6),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 7),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 8),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 9),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 10),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 11),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 12),
        }),
      ]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    // new epoch; return reordered tickets accumulator
    const timeslot = tryAsTimeSlot(10);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);

    const tickets = asKnownSize([
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 1),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 12),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 2),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 11),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 3),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 10),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 4),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 9),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 5),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 8),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 6),
      }),
      Ticket.create({
        attempt: tryAsTicketAttempt(0),
        id: Bytes.fill(HASH_SIZE, 7),
      }),
    ]);

    const input: Input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: reencodeAsView(
        TicketsMarker.Codec,
        TicketsMarker.create( {tickets}),
        tinyChainSpec,
      ),
    };

    const result = await safrole.transition(input);
    assert.ok(result.isOk, "Expected transition to pass successfully");

    deepEqual(
      result.ok.ticketsMark,
      TicketsMarker.create({
        tickets: asKnownSize([
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 1),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 12),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 2),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 11),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 3),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 10),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 4),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 9),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 5),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 8),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 6),
          }),
          Ticket.create({
            attempt: tryAsTicketAttempt(0),
            id: Bytes.fill(HASH_SIZE, 7),
          }),
        ]),
      }),
    );
  });

  it("should return correct result for empty data", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: tryAsTicketAttempt(0),
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    deepEqual(
      result,
      Result.ok({
        // we are ignoring that result anyway, so safe to cast.
        stateUpdate: {} as SafroleStateUpdate,
        epochMark: null,
        ticketsMark: null,
      }),
      { ignore: ["ok.stateUpdate"] },
    );
  });

  it("should return epoch marker missing error when epoch changes but epochMarker is null", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(11),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(12);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.EpochMarkerInvalid);
    }
  });

  it("should return epoch marker unexpected error when epoch is same but epochMarker is not null", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);
    const epochMarker = EpochMarker.create({
      entropy: Bytes.zero(HASH_SIZE).asOpaque(),
      ticketsEntropy: Bytes.zero(HASH_SIZE).asOpaque(),
      validators: asKnownSize(validators.map((validator) => ValidatorKeys.create(validator))),
    });

    const epochMarkerView = Decoder.decodeObject(
      EpochMarker.Codec.View,
      Encoder.encodeObject(EpochMarker.Codec, epochMarker, tinyChainSpec),
      tinyChainSpec,
    );
    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: epochMarkerView,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.EpochMarkerInvalid);
    }
  });

  it("should return tickets mark missing error when tickets marker is required but missing", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(9),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 1),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 2),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 3),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 4),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 5),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 6),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 7),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 8),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 9),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 10),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 11),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 12),
        }),
      ]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(10);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: null,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.TicketsMarkerInvalid);
    }
  });

  it("should return tickets mark unexpected error when tickets marker is present but not wanted", async () => {
    const punishSet = SortedSet.fromArray<Ed25519Key>(hashComparator);
    const state: SafroleState = {
      timeslot: tryAsTimeSlot(1),
      entropy: FixedSizeArray.new(
        [
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
          Bytes.zero(HASH_SIZE).asOpaque(),
        ],
        4,
      ),
      previousValidatorData: validators,
      currentValidatorData: validators,
      designatedValidatorData: validators,
      nextValidatorData: validators,
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, blake2b, state, bwasm);
    const timeslot = tryAsTimeSlot(2);
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);
    const tickets = tryAsPerEpochBlock(
      [
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 1),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 2),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 3),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 4),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 5),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 6),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 7),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 8),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 9),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 10),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 11),
        }),
        Ticket.create({
          attempt: tryAsTicketAttempt(0),
          id: Bytes.fill(HASH_SIZE, 12),
        }),
      ],
      tinyChainSpec,
    );

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
      punishSet,
      epochMarker: null,
      ticketsMarker: reencodeAsView(
        TicketsMarker.Codec,
        TicketsMarker.create( {tickets}),
        tinyChainSpec
      ),
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.TicketsMarkerInvalid);
    }
  });
});
