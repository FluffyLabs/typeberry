import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsEpoch } from "@typeberry/block";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/crypto";
import { OK } from "@typeberry/utils";
import {
  ClientHandler,
  STREAM_KIND_GENERATOR_TO_PROXY,
  ServerHandler,
} from "./ce-131-ce-132-safrole-ticket-distribution.js";
import { testClientServer } from "./test-utils.js";

const TEST_EPOCH = tryAsEpoch(1);
const TEST_TICKET = SignedTicket.create({
  attempt: tryAsTicketAttempt(0),
  signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
});

describe("CE 131 and CE 132: Safrole Ticket Distribution", () => {
  it("Client sends a ticket distribution request and the server receives it", async () => {
    const handlers = testClientServer();

    await new Promise((resolve) => {
      handlers.server.registerHandlers(
        new ServerHandler(STREAM_KIND_GENERATOR_TO_PROXY, (epochIndex, ticket) => {
          assert.strictEqual(epochIndex, TEST_EPOCH);
          assert.deepStrictEqual(ticket, TEST_TICKET);
          resolve(undefined);
        }),
      );
      handlers.client.registerHandlers(new ClientHandler(STREAM_KIND_GENERATOR_TO_PROXY));

      handlers.client.withNewStream(
        STREAM_KIND_GENERATOR_TO_PROXY,
        (handler: ClientHandler<typeof STREAM_KIND_GENERATOR_TO_PROXY>, sender) => {
          handler.sendTicket(sender, TEST_EPOCH, TEST_TICKET);
          return OK;
        },
      );
    });
  });
});
