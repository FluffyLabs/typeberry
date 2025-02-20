import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { Ed25519Key, EntropyHash, PerValidator, TimeSlot } from "@typeberry/block";
import type { SignedTicket, TicketAttempt } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { FixedSizeArray, Ordering, SortedSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import type { ValidatorData } from "@typeberry/state";
import * as bandersnatch from "./bandersnatch";
import { Safrole, SafroleErrorCode, type SafroleState } from "./safrole";

describe("Safrole", () => {
  beforeEach(() => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(32) },
        { isValid: true, entropyHash: Bytes.fill(32, 1) },
      ]),
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should return incorrect timeslot error", async () => {
    const state = { timeslot: 1 } as SafroleState;
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 0 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [];
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
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [];
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
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [
      {
        attempt: (tinyChainSpec.ticketsPerValidator + 2) as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
    ];

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
      Promise.resolve([{ isValid: false, entropyHash: Bytes.zero(32) }]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
      entropy: FixedSizeArray.new(
        [Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque()],
        4,
      ),
      previousValidatorData: [] as unknown as PerValidator<ValidatorData>,
      currentValidatorData: [] as unknown as PerValidator<ValidatorData>,
      designatedValidatorData: [] as unknown as PerValidator<ValidatorData>,
      nextValidatorData: [] as unknown as PerValidator<ValidatorData>,
      punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      ticketsAccumulator: [],
      sealingKeySeries: {},
      epochRoot: Bytes.zero(32).asOpaque(),
    };
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
    ];

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

  it("should return duplocated ticket error", async () => {
    mock.method(bandersnatch, "verifyTickets", () =>
      Promise.resolve([
        { isValid: true, entropyHash: Bytes.zero(32) },
        { isValid: true, entropyHash: Bytes.zero(32) },
      ]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
      entropy: FixedSizeArray.new(
        [Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque()],
        4,
      ),
      previousValidatorData: [] as unknown as PerValidator<ValidatorData>,
      currentValidatorData: [] as unknown as PerValidator<ValidatorData>,
      designatedValidatorData: [] as unknown as PerValidator<ValidatorData>,
      nextValidatorData: [] as unknown as PerValidator<ValidatorData>,
      punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      ticketsAccumulator: [],
      sealingKeySeries: {},
      epochRoot: Bytes.zero(32).asOpaque(),
    };
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
    ];

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
        { isValid: true, entropyHash: Bytes.fill(32, 1) },
        { isValid: true, entropyHash: Bytes.zero(32) },
      ]),
    );
    const state: SafroleState = {
      timeslot: 1 as TimeSlot,
      entropy: FixedSizeArray.new(
        [Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque()],
        4,
      ),
      previousValidatorData: [] as unknown as PerValidator<ValidatorData>,
      currentValidatorData: [] as unknown as PerValidator<ValidatorData>,
      designatedValidatorData: [] as unknown as PerValidator<ValidatorData>,
      nextValidatorData: [] as unknown as PerValidator<ValidatorData>,
      punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      ticketsAccumulator: [],
      sealingKeySeries: {},
      epochRoot: Bytes.zero(32).asOpaque(),
    };
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.fill(784, 1).asOpaque(),
      },
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
    ];

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
        [Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque(), Bytes.zero(32).asOpaque()],
        4,
      ),
      previousValidatorData: [] as unknown as PerValidator<ValidatorData>,
      currentValidatorData: [] as unknown as PerValidator<ValidatorData>,
      designatedValidatorData: [] as unknown as PerValidator<ValidatorData>,
      nextValidatorData: [] as unknown as PerValidator<ValidatorData>,
      punishSet: SortedSet.fromArray<Ed25519Key>(() => Ordering.Equal, []),
      ticketsAccumulator: [],
      sealingKeySeries: {},
      epochRoot: Bytes.zero(32).asOpaque(),
    };
    const safrole = new Safrole(state, tinyChainSpec);
    const timeslot = 2 as TimeSlot;
    const entropy: EntropyHash = Bytes.zero(32).asOpaque();
    const extrinsic: SignedTicket[] = [
      {
        attempt: 0 as TicketAttempt,
        signature: Bytes.zero(784).asOpaque(),
      },
    ];

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
