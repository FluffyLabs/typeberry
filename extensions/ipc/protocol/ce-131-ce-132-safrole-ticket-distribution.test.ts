import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsEpoch } from "@typeberry/block";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/block/crypto";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { MessageHandler, type MessageSender } from "../handler";
import {
  ClientHandler,
  STREAM_KIND_GENERATOR_TO_PROXY,
  ServerHandler,
} from "./ce-131-ce-132-safrole-ticket-distribution";

const TEST_EPOCH = tryAsEpoch(1);
const TEST_TICKET = SignedTicket.create({
  attempt: tryAsTicketAttempt(0),
  signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
});

class FakeMessageSender implements MessageSender {
  constructor(
    public readonly onMessage: (data: BytesBlob) => void,
    public readonly onClose: () => void,
  ) {}

  send(data: BytesBlob): void {
    setImmediate(() => {
      this.onMessage(data);
    });
  }

  close(): void {
    setImmediate(() => {
      this.onClose();
    });
  }
}

describe("CE 131 and CE 132: Safrole Ticket Distribution", () => {
  it("Client sends a ticket distribution request and the server receives it", async () => {
    const handlers = {} as { client: MessageHandler; server: MessageHandler };
    handlers.client = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.server.onSocketMessage(data.raw);
        },
        () => {
          handlers.server.onClose({});
        },
      ),
    );
    handlers.server = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.client.onSocketMessage(data.raw);
        },
        () => {
          handlers.client.onClose({});
        },
      ),
    );

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
        },
      );
    });
  });
});
