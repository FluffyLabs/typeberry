import { codec } from "@typeberry/codec";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";
import { TicketsMessage } from "./tickets-message.js";

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
  // Messages from jam-network to block-authorship (none for now)
  fromWorker: {},
});

export type NetworkingComms = Api<typeof protocol>;
export type AuthorshipComms = Internal<typeof protocol>;
