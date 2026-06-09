import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsEpoch } from "@typeberry/block";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/crypto";
import { AcceptTicketsValidator, DenyTicketsValidator, ValidationError } from "./ticket-validator.js";

const E1 = tryAsEpoch(1);

function makeTicket(): SignedTicket {
  return SignedTicket.create({
    attempt: tryAsTicketAttempt(0),
    signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
  });
}

describe("AcceptTicketsValidator", () => {
  it("returns ok with zero id", async () => {
    const v = new AcceptTicketsValidator();
    const res = await v.validate(E1, [makeTicket()]);
    assert.strictEqual(res.isOk, true);
    if (res.isOk) {
      assert.strictEqual(res.ok[0].id.toString(), "0x00");
    }
  });
});

describe("DenyTicketsValidator", () => {
  it("returns ValidatorUnavailable", async () => {
    const v = new DenyTicketsValidator();
    const res = await v.validate(E1, [makeTicket()]);
    assert.strictEqual(res.isError, true);
    if (res.isError) {
      assert.strictEqual(res.error, ValidationError.ValidatorUnavailable);
    }
  });
});
