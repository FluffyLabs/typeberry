import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_PROOF_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  BLS_KEY_BYTES,
  type EntropyHash,
  type PerValidator,
  type TimeSlot,
} from "@typeberry/block";
import type { TicketAttempt, TicketsExtrinsic } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { FixedSizeArray, SortedSet, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { Ordering } from "@typeberry/ordering";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { type SafroleSealingKeys, SafroleSealingKeysKind } from "@typeberry/state/safrole-data";
import * as bandersnatch from "./bandersnatch";
import { BandernsatchWasm } from "./bandersnatch-wasm";
import { Safrole, SafroleErrorCode, type SafroleState } from "./safrole";

const bwasm = BandernsatchWasm.new({ synchronous: true });

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
    ValidatorData.fromCodec({
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
  beforeEach(() => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
        { isValid: true, entropyHash: Bytes.fill(HASH_SIZE, 1) },
      ]),
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should return incorrect timeslot error", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 0 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);
    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadSlot);
    }
  });

  it("should return unexpected ticket because of incorrect length of extrinsic", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([]);
    extrinsic.length = tinyChainSpec.epochLength + 1;
    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.UnexpectedTicket);
    }
  });

  it("should return bad ticket attempt because of incorrect ticket attempt", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: (tinyChainSpec.ticketsPerValidator + 2) as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketAttempt);
    }
  });

  it("should return bad ticket proof error", async () => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([{ isValid: false, entropyHash: Bytes.zero(HASH_SIZE) }]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
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
      disputesRecords: {
        punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      },
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketProof);
    }
  });

  it("should return duplicated ticket error", async () => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
      ]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
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
      disputesRecords: {
        punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      },
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.DuplicateTicket);
    }
  });

  it("should return bad ticket order error", async () => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.fill(HASH_SIZE, 1) },
        { isValid: true, entropyHash: Bytes.zero(HASH_SIZE) },
      ]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
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
      disputesRecords: {
        punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      },
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.fill(BANDERSNATCH_PROOF_BYTES, 1).asOpaque(),
      },
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isError, true);
    if (result.isError) {
      assert.deepEqual(result.error, SafroleErrorCode.BadTicketOrder);
    }
  });

  it("should return correct result for empty data", async () => {
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
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
      disputesRecords: {
        punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      },
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: fakeSealingKeys,
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    };
    const safrole = new Safrole(tinyChainSpec, state, bwasm);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const extrinsic: TicketsExtrinsic = asKnownSize([
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
      },
    ]);

    const input = {
      slot: timeslot,
      entropy,
      extrinsic,
    };

    const result = await safrole.transition(input);

    assert.deepEqual(result.isOk, true);
    if (result.isOk) {
      assert.deepStrictEqual(result.ok, {
        epochMark: null,
        ticketsMark: null,
      });
    }
  });
});
