import assert from "node:assert";
import { describe, it } from "node:test";
import { Block, emptyBlock, type HeaderHash, reencodeAsView, tryAsEpoch } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import {
  protocol as authorshipProtocol,
  type NetworkingComms,
  TicketsMessage,
} from "@typeberry/comms-authorship-network";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, WithHash } from "@typeberry/hash";
import { Channel, DirectPort } from "@typeberry/workers-api";
import { startOfflineNetworkingWorker } from "./index.js";

describe("OfflineNetworking", () => {
  it("routes all inbound and outbound networking messages", async () => {
    const [networkingPort, authorshipPort] = DirectPort.pair();
    const worker = startOfflineNetworkingWorker(networkingPort);
    const authorship: NetworkingComms = Channel.tx(authorshipProtocol, authorshipPort);

    const block = reencodeAsView(Block.Codec, emptyBlock(), tinyChainSpec);
    let submittedBlock: typeof block | null = null;
    worker.network.setOnBlocks(async (blocks) => {
      submittedBlock = blocks[0];
    });
    await worker.offline.submitBlock(block);
    assert.strictEqual(submittedBlock, block);

    const header = WithHash.new(Bytes.zero(HASH_SIZE).asOpaque<HeaderHash>(), block.header.view());
    let announcedHeader: typeof header | null = null;
    worker.offline.announcedHeaders.once((value) => {
      announcedHeader = value;
    });
    await worker.network.sendNewHeader(header);
    assert.strictEqual(announcedHeader, header);

    const tickets = TicketsMessage.create({ epochIndex: tryAsEpoch(1), tickets: [] });
    let announcedTickets: TicketsMessage | null = null;
    worker.offline.announcedTickets.once((value) => {
      announcedTickets = value;
    });
    await authorship.sendTickets(tickets);
    assert.strictEqual(announcedTickets, tickets);

    let replacement: TicketsMessage | null = null;
    worker.offline.ticketPoolReplacements.once((value) => {
      replacement = value;
    });
    await authorship.sendReplaceTicketPool(tickets);
    assert.strictEqual(replacement, tickets);

    const receivedTickets: TicketsMessage[] = [];
    let acceptTickets = true;
    authorship.setOnReceivedTickets(async (value) => {
      receivedTickets.push(value);
      return acceptTickets;
    });
    assert.strictEqual(await worker.offline.submitTickets(tickets.epochIndex, tickets.tickets), true);
    acceptTickets = false;
    assert.strictEqual(await worker.offline.submitTickets(tickets.epochIndex, tickets.tickets), false);
    assert.strictEqual(receivedTickets[0].epochIndex, tickets.epochIndex);
    assert.strictEqual(receivedTickets[0].tickets, tickets.tickets);
    assert.strictEqual(receivedTickets.length, 2);

    const firstFinish = worker.finish();
    assert.strictEqual(worker.finish(), firstFinish);
    await firstFinish;
    await assert.rejects(worker.offline.submitBlock(block), /Offline networking has finished/);
    await assert.rejects(
      worker.offline.submitTickets(tickets.epochIndex, tickets.tickets),
      /Offline networking has finished/,
    );
  });
});
