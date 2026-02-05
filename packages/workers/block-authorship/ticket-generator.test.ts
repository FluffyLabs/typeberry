import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { type SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { BANDERSNATCH_KEY_BYTES, initWasm, SEED_SIZE } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { Result } from "@typeberry/utils";
import { generateTickets, TicketGeneratorError, type ValidatorKey } from "./ticket-generator.js";

const MOCK_ENTROPY = Bytes.zero(HASH_SIZE).asOpaque();
const MOCK_BANDERSNATCH = {} as BandernsatchWasm;

function createMockRingKeys(count: number) {
  return Array.from({ length: count }, (_, i) => Bytes.fill(BANDERSNATCH_KEY_BYTES, i).asOpaque());
}

function createMockValidatorKeys(count: number): ValidatorKey[] {
  return Array.from({ length: count }, (_, i) => ({
    secret: Bytes.fill(SEED_SIZE, i).asOpaque(),
    public: Bytes.fill(BANDERSNATCH_KEY_BYTES, i).asOpaque(),
  }));
}

describe("Ticket Generator", () => {
  beforeEach(async () => {
    await initWasm();

    mock.method(
      bandersnatchVrf,
      "generateTickets",
      async (
        _bandersnatch: unknown,
        _ringKeys: unknown,
        _proverIndex: unknown,
        _key: unknown,
        _entropy: unknown,
        ticketsPerValidator: number,
      ) => {
        const tickets: SignedTicket[] = [];
        for (let attempt = 0; attempt < ticketsPerValidator; attempt++) {
          tickets.push({
            attempt: tryAsTicketAttempt(attempt),
            signature: Bytes.zero(784).asOpaque(),
          } as SignedTicket);
        }
        return Result.ok(tickets);
      },
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("generateTickets", () => {
    it("should generate correct total number of tickets", async () => {
      const ringKeys = createMockRingKeys(3);
      const validatorKeys = createMockValidatorKeys(3);
      const ticketsPerValidator = 2;

      const result = await generateTickets(
        MOCK_BANDERSNATCH,
        ringKeys,
        validatorKeys,
        MOCK_ENTROPY,
        ticketsPerValidator,
      );

      assert.ok(result.isOk);
      assert.strictEqual(result.ok.length, 6);
    });

    it("should generate tickets with correct attempt values", async () => {
      const ringKeys = createMockRingKeys(2);
      const validatorKeys = createMockValidatorKeys(2);
      const ticketsPerValidator = 2;

      const result = await generateTickets(
        MOCK_BANDERSNATCH,
        ringKeys,
        validatorKeys,
        MOCK_ENTROPY,
        ticketsPerValidator,
      );

      assert.ok(result.isOk);
      const tickets = result.ok;
      assert.strictEqual(tickets[0].attempt, tryAsTicketAttempt(0));
      assert.strictEqual(tickets[1].attempt, tryAsTicketAttempt(1));
      assert.strictEqual(tickets[2].attempt, tryAsTicketAttempt(0));
      assert.strictEqual(tickets[3].attempt, tryAsTicketAttempt(1));
    });

    it("should return empty array for no validator keys", async () => {
      const ringKeys = createMockRingKeys(3);
      const ticketsPerValidator = 2;

      const result = await generateTickets(MOCK_BANDERSNATCH, ringKeys, [], MOCK_ENTROPY, ticketsPerValidator);

      assert.ok(result.isOk);
      assert.strictEqual(result.ok.length, 0);
    });

    it("should skip validators not in the ring and return tickets for valid ones", async () => {
      const ticketsPerValidator = 2;
      const ringKeys = createMockRingKeys(3);
      const correctValidatorKeys = createMockValidatorKeys(2);
      const incorrectValidatorKeys: ValidatorKey[] = [
        {
          secret: Bytes.fill(SEED_SIZE, 99).asOpaque(),
          public: Bytes.fill(BANDERSNATCH_KEY_BYTES, 99).asOpaque(),
        },
      ];
      const validatorKeys = [...correctValidatorKeys, ...incorrectValidatorKeys];

      const result = await generateTickets(
        MOCK_BANDERSNATCH,
        ringKeys,
        validatorKeys,
        MOCK_ENTROPY,
        ticketsPerValidator,
      );

      assert.ok(result.isOk);
      // Only the 2 valid validators should produce tickets
      assert.strictEqual(result.ok.length, 4);
    });

    it("should error when all validators fail", async () => {
      const ticketsPerValidator = 2;
      const ringKeys = createMockRingKeys(3);
      const invalidValidatorKeys: ValidatorKey[] = [
        {
          secret: Bytes.fill(SEED_SIZE, 99).asOpaque(),
          public: Bytes.fill(BANDERSNATCH_KEY_BYTES, 99).asOpaque(),
        },
        {
          secret: Bytes.fill(SEED_SIZE, 98).asOpaque(),
          public: Bytes.fill(BANDERSNATCH_KEY_BYTES, 98).asOpaque(),
        },
      ];

      const result = await generateTickets(
        MOCK_BANDERSNATCH,
        ringKeys,
        invalidValidatorKeys,
        MOCK_ENTROPY,
        ticketsPerValidator,
      );

      assert.ok(result.isError);
      assert.strictEqual(result.error, TicketGeneratorError.TicketGenerationFailed);
    });
  });
});
