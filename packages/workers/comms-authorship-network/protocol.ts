import { codec } from "@typeberry/codec";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";
import { ReceivedTicketMessage, TicketsMessage } from "./tickets-message.js";

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
  // Messages from block-authorship to jam-network
  toWorker: {
    tickets: {
      request: TicketsMessage.Codec,
      response: codec.nothing,
    },
  },
  // Messages from jam-network to block-authorship (one ticket per relay).
  // Response indicates whether the ticket passed validation — used by jam-network
  // to decide whether to redistribute the ticket to other peers.
  fromWorker: {
    receivedTickets: {
      request: ReceivedTicketMessage.Codec,
      response: codec.bool,
    },
  },
});

export type NetworkingComms = Api<typeof protocol>;
export type AuthorshipComms = Internal<typeof protocol>;
