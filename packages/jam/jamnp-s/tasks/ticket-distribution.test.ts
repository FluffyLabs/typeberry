import assert from "node:assert";
import { describe, it } from "node:test";
import { setTimeout } from "node:timers/promises";
import { type Epoch, tryAsEpoch } from "@typeberry/block";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { createTestPeerPair, MockNetwork } from "@typeberry/networking/testing.js";
import { OK } from "@typeberry/utils";
import { Connections } from "../peers.js";
import { ce131 } from "../protocol/index.js";
import { StreamManager } from "../stream-manager.js";

const logger = Logger.new(import.meta.filename, "test:tickets");

const TEST_EPOCH = tryAsEpoch(42);

function createTestTicket(attempt: number): SignedTicket {
  return SignedTicket.create({
    attempt: tryAsTicketAttempt(attempt),
    signature: Bytes.zero(BANDERSNATCH_PROOF_BYTES).asOpaque(),
  });
}

/**
 * Simplified TicketDistributionTask for testing that exposes received tickets.
 * This mirrors the real implementation but allows us to capture received tickets.
 */
function createTestTicketTask(streamManager: StreamManager, connections: Connections) {
  const receivedTickets: { epochIndex: Epoch; ticket: SignedTicket }[] = [];

  // server mode: receive tickets from peers
  streamManager.registerIncomingHandlers(
    new ce131.ServerHandler(ce131.STREAM_KIND_PROXY_TO_ALL, (epochIndex, ticket) => {
      logger.log`Received ticket for epoch ${epochIndex}, attempt ${ticket.attempt}`;
      receivedTickets.push({ epochIndex, ticket });
    }),
  );

  // client mode: send tickets to peers
  streamManager.registerOutgoingHandlers(new ce131.ClientHandler(ce131.STREAM_KIND_PROXY_TO_ALL));

  const distributeTicket = (epochIndex: Epoch, ticket: SignedTicket) => {
    const peers = connections.getConnectedPeers();
    for (const peerInfo of peers) {
      if (peerInfo.peerRef === null) {
        continue;
      }
      streamManager.withNewStream<ce131.ClientHandler<typeof ce131.STREAM_KIND_PROXY_TO_ALL>>(
        peerInfo.peerRef,
        ce131.STREAM_KIND_PROXY_TO_ALL,
        (handler, sender) => {
          logger.log`[${peerInfo.peerId}] <-- Sending ticket for epoch ${epochIndex}`;
          handler.sendTicket(sender, epochIndex, ticket);
          return OK;
        },
      );
    }
  };

  return {
    distributeTicket,
    receivedTickets,
  };
}

describe("TicketDistributionTask", () => {
  async function init(name: string) {
    const network = new MockNetwork(name);
    const streamManager = new StreamManager();
    const connections = new Connections(network);

    const ticketTask = createTestTicketTask(streamManager, connections);

    // Setup peer listeners for incoming streams
    network.peers.onPeerConnected((peer) => {
      peer.addOnIncomingStream((stream) => {
        streamManager.onIncomingStream(peer, stream);
        return OK;
      });
      return OK;
    });

    let connectionIdx = 0;
    const openConnection = (other: { name: string; network: MockNetwork }) => {
      const [self, peer] = createTestPeerPair(connectionIdx++, name, other.name);
      network._peers.peerConnected(peer);
      other.network._peers.peerConnected(self);
      return [self, peer] as const;
    };

    return {
      name,
      ticketTask,
      network,
      connections,
      streamManager,
      openConnection,
    };
  }

  async function tick() {
    logger.log`tick`;
    await setTimeout(10);
  }

  it("should distribute ticket to all connected peers", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");
    const peer2 = await init("peer2");

    self.openConnection(peer1);
    self.openConnection(peer2);
    await tick();

    const ticket = createTestTicket(0);
    self.ticketTask.distributeTicket(TEST_EPOCH, ticket);
    await tick();

    // Both peers should have received the ticket
    assert.strictEqual(peer1.ticketTask.receivedTickets.length, 1);
    assert.strictEqual(peer1.ticketTask.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(peer1.ticketTask.receivedTickets[0].ticket, ticket);

    assert.strictEqual(peer2.ticketTask.receivedTickets.length, 1);
    assert.strictEqual(peer2.ticketTask.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(peer2.ticketTask.receivedTickets[0].ticket, ticket);
  });

  it("should receive tickets from peers", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket = createTestTicket(1);
    peer1.ticketTask.distributeTicket(TEST_EPOCH, ticket);
    await tick();

    assert.strictEqual(self.ticketTask.receivedTickets.length, 1);
    assert.strictEqual(self.ticketTask.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(self.ticketTask.receivedTickets[0].ticket, ticket);
  });

  it("should handle multiple tickets", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket0 = createTestTicket(0);
    const ticket1 = createTestTicket(1);

    self.ticketTask.distributeTicket(TEST_EPOCH, ticket0);
    self.ticketTask.distributeTicket(TEST_EPOCH, ticket1);
    await tick();

    assert.strictEqual(peer1.ticketTask.receivedTickets.length, 2);
    assert.deepStrictEqual(peer1.ticketTask.receivedTickets[0].ticket, ticket0);
    assert.deepStrictEqual(peer1.ticketTask.receivedTickets[1].ticket, ticket1);
  });

  it("should handle no connected peers gracefully", async () => {
    const self = await init("self");

    const ticket = createTestTicket(0);
    // Should not throw
    self.ticketTask.distributeTicket(TEST_EPOCH, ticket);
    await tick();
  });
});
