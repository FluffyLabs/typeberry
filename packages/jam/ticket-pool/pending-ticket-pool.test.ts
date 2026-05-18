import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsEpoch } from "@typeberry/block";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/crypto";
import { PendingTicketPool } from "./pending-ticket-pool.js";

const E1 = tryAsEpoch(1);
const E2 = tryAsEpoch(2);

function makeTicket(seed: number, attempt = 0): SignedTicket {
  const sig = Bytes.zero(BANDERSNATCH_PROOF_BYTES);
  sig.raw[0] = seed;
  return SignedTicket.create({
    attempt: tryAsTicketAttempt(attempt),
    signature: sig.asOpaque(),
  });
}

describe("PendingTicketPool", () => {
  it("starts empty with no current epoch", () => {
    const pool = new PendingTicketPool();
    assert.strictEqual(pool.currentEpoch, null);
    assert.deepStrictEqual(pool.getTickets(), []);
  });

  it("adds a ticket and tracks the epoch", () => {
    const pool = new PendingTicketPool();
    const t = makeTicket(1);
    assert.strictEqual(pool.addTicket(E1, t), true);
    assert.strictEqual(pool.currentEpoch, E1);
    assert.strictEqual(pool.getTickets().length, 1);
  });

  it("dedups by signature within an epoch", () => {
    const pool = new PendingTicketPool();
    const t = makeTicket(1);
    pool.addTicket(E1, t);
    assert.strictEqual(pool.addTicket(E1, t), false);
    assert.strictEqual(pool.getTickets().length, 1);
  });

  it("clears tickets when a newer epoch arrives", () => {
    const pool = new PendingTicketPool();
    pool.addTicket(E1, makeTicket(1));
    pool.addTicket(E1, makeTicket(2));
    pool.addTicket(E2, makeTicket(3));
    const tickets = pool.getTickets();
    assert.strictEqual(tickets.length, 1);
    assert.strictEqual(tickets[0].epochIndex, E2);
    assert.strictEqual(pool.currentEpoch, E2);
  });

  it("drops late tickets for older epochs", () => {
    const pool = new PendingTicketPool();
    pool.addTicket(E2, makeTicket(1));
    assert.strictEqual(pool.addTicket(E1, makeTicket(2)), false);
    assert.strictEqual(pool.getTickets().length, 1);
    assert.strictEqual(pool.currentEpoch, E2);
  });

  it("replace clears existing tickets and dedups the new set", () => {
    const pool = new PendingTicketPool();
    pool.addTicket(E1, makeTicket(1));
    pool.addTicket(E1, makeTicket(2));
    const dump = [makeTicket(3), makeTicket(4), makeTicket(3)];
    pool.replace(E2, dump);
    const tickets = pool.getTickets();
    assert.strictEqual(tickets.length, 2);
    assert.strictEqual(pool.currentEpoch, E2);
    assert.strictEqual(tickets[0].ticket.signature.raw[0], 3);
    assert.strictEqual(tickets[1].ticket.signature.raw[0], 4);
  });
});
