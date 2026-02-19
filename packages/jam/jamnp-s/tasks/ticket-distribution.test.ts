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
import { StreamManager } from "../stream-manager.js";
import { TicketDistributionTask } from "./ticket-distribution.js";

const logger = Logger.new(import.meta.filename, "test:tickets");

const TEST_EPOCH = tryAsEpoch(42);
const OTHER_EPOCH = tryAsEpoch(43);

function createTestTicket(attempt: number, signatureByte = 0): SignedTicket {
  const signatureBytes = Bytes.zero(BANDERSNATCH_PROOF_BYTES);
  // Make signature unique based on attempt and signatureByte
  signatureBytes.raw[0] = attempt;
  signatureBytes.raw[1] = signatureByte;
  return SignedTicket.create({
    attempt: tryAsTicketAttempt(attempt),
    signature: signatureBytes.asOpaque(),
  });
}

describe("TicketDistributionTask", () => {
  async function init(name: string) {
    const network = new MockNetwork(name);
    const streamManager = new StreamManager();
    const connections = new Connections(network);

    // Track received tickets for verification
    const receivedTickets: { epochIndex: Epoch; ticket: SignedTicket }[] = [];

    // Use real TicketDistributionTask
    const ticketTask = TicketDistributionTask.start(streamManager, connections);

    // Intercept received tickets by wrapping onTicketReceived behavior
    // The task already adds received tickets to pending queue via addTicket,
    // so we can track them by checking the pending queue growth or by
    // hooking into the CE-131 server handler directly
    const originalAddTicket = ticketTask.addTicket.bind(ticketTask);
    ticketTask.addTicket = (epochIndex: Epoch, ticket: SignedTicket) => {
      receivedTickets.push({ epochIndex, ticket });
      originalAddTicket(epochIndex, ticket);
    };

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
      receivedTickets,
    };
  }

  async function tick() {
    logger.log`tick`;
    await setTimeout(10);
  }

  it("should distribute ticket to all connected peers via maintainDistribution", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");
    const peer2 = await init("peer2");

    self.openConnection(peer1);
    self.openConnection(peer2);
    await tick();

    const ticket = createTestTicket(0);
    self.ticketTask.addTicket(TEST_EPOCH, ticket);
    self.ticketTask.maintainDistribution();
    await tick();

    // Both peers should have received the ticket
    assert.strictEqual(peer1.receivedTickets.length, 1);
    assert.strictEqual(peer1.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(peer1.receivedTickets[0].ticket, ticket);

    assert.strictEqual(peer2.receivedTickets.length, 1);
    assert.strictEqual(peer2.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(peer2.receivedTickets[0].ticket, ticket);
  });

  it("should receive tickets from peers", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket = createTestTicket(1);
    peer1.ticketTask.addTicket(TEST_EPOCH, ticket);
    peer1.ticketTask.maintainDistribution();
    await tick();

    assert.strictEqual(self.receivedTickets.length, 1);
    assert.strictEqual(self.receivedTickets[0].epochIndex, TEST_EPOCH);
    assert.deepStrictEqual(self.receivedTickets[0].ticket, ticket);
  });

  it("should handle multiple tickets", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket0 = createTestTicket(0);
    const ticket1 = createTestTicket(1);

    self.ticketTask.addTicket(TEST_EPOCH, ticket0);
    self.ticketTask.addTicket(TEST_EPOCH, ticket1);
    self.ticketTask.maintainDistribution();
    await tick();

    assert.strictEqual(peer1.receivedTickets.length, 2);
    assert.deepStrictEqual(peer1.receivedTickets[0].ticket, ticket0);
    assert.deepStrictEqual(peer1.receivedTickets[1].ticket, ticket1);
  });

  it("should handle no connected peers gracefully", async () => {
    const self = await init("self");

    const ticket = createTestTicket(0);
    // Should not throw
    self.ticketTask.addTicket(TEST_EPOCH, ticket);
    self.ticketTask.maintainDistribution();
    await tick();
  });

  it("should deduplicate tickets with same signature", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket = createTestTicket(0);

    // Add same ticket twice
    self.ticketTask.addTicket(TEST_EPOCH, ticket);
    self.ticketTask.addTicket(TEST_EPOCH, ticket);
    self.ticketTask.maintainDistribution();
    await tick();

    // Peer should only receive it once
    assert.strictEqual(peer1.receivedTickets.length, 1);
  });

  it("should not send same ticket to same peer twice", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket = createTestTicket(0);
    self.ticketTask.addTicket(TEST_EPOCH, ticket);

    // Call maintainDistribution twice
    self.ticketTask.maintainDistribution();
    await tick();
    self.ticketTask.maintainDistribution();
    await tick();

    // Peer should only receive the ticket once (aux data tracks sent indices)
    assert.strictEqual(peer1.receivedTickets.length, 1);
  });

  it("should clear tickets when epoch changes", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");

    self.openConnection(peer1);
    await tick();

    const ticket1 = createTestTicket(0);
    const ticket2 = createTestTicket(1);

    // Add ticket for first epoch
    self.ticketTask.addTicket(TEST_EPOCH, ticket1);

    // Change epoch - this should clear old tickets
    self.ticketTask.addTicket(OTHER_EPOCH, ticket2);
    self.ticketTask.maintainDistribution();
    await tick();

    // Peer should only receive the second ticket (first was cleared on epoch change)
    assert.strictEqual(peer1.receivedTickets.length, 1);
    assert.strictEqual(peer1.receivedTickets[0].epochIndex, OTHER_EPOCH);
    assert.deepStrictEqual(peer1.receivedTickets[0].ticket, ticket2);
  });

  it("should send new tickets to newly connected peers", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");
    const peer2 = await init("peer2");

    // Connect peer1 first
    self.openConnection(peer1);
    await tick();

    const ticket = createTestTicket(0);
    self.ticketTask.addTicket(TEST_EPOCH, ticket);
    self.ticketTask.maintainDistribution();
    await tick();

    // Now connect peer2 after ticket was already distributed to peer1
    self.openConnection(peer2);
    await tick();

    // Run maintainDistribution again - peer2 should get the ticket
    self.ticketTask.maintainDistribution();
    await tick();

    assert.strictEqual(peer1.receivedTickets.length, 1);
    assert.strictEqual(peer2.receivedTickets.length, 1);
    assert.deepStrictEqual(peer2.receivedTickets[0].ticket, ticket);
  });

  it("should re-distribute received tickets to other peers", async () => {
    const self = await init("self");
    const peer1 = await init("peer1");
    const peer2 = await init("peer2");

    // Self connects to both peers
    self.openConnection(peer1);
    self.openConnection(peer2);
    await tick();

    // peer1 sends a ticket to self
    const ticket = createTestTicket(0);
    peer1.ticketTask.addTicket(TEST_EPOCH, ticket);
    peer1.ticketTask.maintainDistribution();
    await tick();

    // Self receives the ticket (via onTicketReceived -> addTicket)
    assert.strictEqual(self.receivedTickets.length, 1);

    // Self should re-distribute to peer2 (and peer1, but peer1 already has it)
    self.ticketTask.maintainDistribution();
    await tick();

    // peer2 should now have received the ticket from self
    assert.strictEqual(peer2.receivedTickets.length, 1);
    assert.deepStrictEqual(peer2.receivedTickets[0].ticket, ticket);
  });
});
