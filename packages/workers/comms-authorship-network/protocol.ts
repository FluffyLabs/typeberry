import { codec } from "@typeberry/codec";
import { createProtocol } from "@typeberry/workers-api/protocol.js";
import type { Api, Internal } from "@typeberry/workers-api/types.js";
import { TicketsMessage } from "./tickets-message.js";

/**
 * Port name for authorship-network direct communication.
 * Used when spawning jam-network worker to pass the port for receiving tickets.
 */
export const AUTHORSHIP_NETWORK_PORT = "authorship-network";

/**
 * Protocol for direct communication between block-authorship and jam-network workers.
 *
 * This bypasses the main thread for ticket distribution, reducing latency.
 */
export const protocol = createProtocol("authorship-network", {
  // Messages from block-authorship to jam-network.
  toWorker: {
    // Newly generated own tickets; networking should add them to its redistribution pool.
    tickets: {
      request: TicketsMessage.Codec,
      response: codec.nothing,
    },
    // Authoritative pool snapshot for the given epoch; networking replaces its local
    // pool with these tickets (one-way, source of truth lives in block-authorship).
    replaceTicketPool: {
      request: TicketsMessage.Codec,
      response: codec.nothing,
    },
  },
  // Messages from jam-network to block-authorship
  // Response indicates whether all tickets in batch were valid (no per-ticket validity!)
  fromWorker: {
    receivedTickets: {
      request: TicketsMessage.Codec,
      response: codec.bool,
    },
  },
});

export type NetworkingComms = Api<typeof protocol>;
export type AuthorshipComms = Internal<typeof protocol>;
