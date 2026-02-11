import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Logger } from "@typeberry/logger";
import { OK } from "@typeberry/utils";
import type { AuxData, Connections } from "../peers.js";
import { ce131 } from "../protocol/index.js";
import type { StreamManager } from "../stream-manager.js";

const logger = Logger.new(import.meta.filename, "net:tickets");

/** Aux data to track which tickets have been sent to each peer (using indices) */
const TICKET_AUX: AuxData<Set<number>> = {
  id: Symbol("tickets"),
};

/**
 * Manages distribution of Safrole tickets to connected peers.
 *
 * Uses CE-132 (proxy-to-all) for direct broadcast to all peers.
 * Implements a maintain pattern similar to SyncTask: tickets are collected
 * and periodically distributed to peers that haven't received them yet.
 */
export class TicketDistributionTask {
  static start(streamManager: StreamManager, connections: Connections) {
    const task = new TicketDistributionTask(streamManager, connections);

    // server mode: receive tickets from peers
    streamManager.registerIncomingHandlers(
      new ce131.ServerHandler(ce131.STREAM_KIND_PROXY_TO_ALL, (epochIndex, ticket) => {
        task.onTicketReceived(epochIndex, ticket);
      }),
    );

    // client mode: send tickets to peers
    streamManager.registerOutgoingHandlers(new ce131.ClientHandler(ce131.STREAM_KIND_PROXY_TO_ALL));

    return task;
  }

  /** Pending tickets waiting to be distributed to peers */
  private pendingTickets: Array<{ epochIndex: Epoch; ticket: SignedTicket }> = [];
  /** Current epoch being tracked (cleared when epoch changes) */
  private currentEpoch: Epoch | null = null;

  private constructor(
    private readonly streamManager: StreamManager,
    private readonly connections: Connections,
  ) {}

  /**
   * Should be called periodically to distribute pending tickets to connected peers.
   */
  maintainDistribution() {
    const peerCount = this.connections.getPeerCount();
    if (peerCount === 0) {
      return;
    }

    if (this.pendingTickets.length === 0) {
      return;
    }

    logger.log`[maintain] Distributing ${this.pendingTickets.length} tickets to ${peerCount} peers`;

    // Track how many tickets we sent
    let sentCount = 0;

    // Iterate through all pending tickets
    for (let ticketIdx = 0; ticketIdx < this.pendingTickets.length; ticketIdx++) {
      const { epochIndex, ticket } = this.pendingTickets[ticketIdx];

      // Try to send to each connected peer
      for (const peerInfo of this.connections.getConnectedPeers()) {
        if (peerInfo.peerRef === null) {
          continue;
        }

        // Check if we already sent this ticket to this peer
        const sentIndices = this.connections.getAuxData(peerInfo.peerId, TICKET_AUX);
        if (sentIndices?.has(ticketIdx) === true) {
          continue; // Already sent
        }

        // Mark as sent
        this.connections.withAuxData(peerInfo.peerId, TICKET_AUX, (aux) => {
          const newSet = aux ?? new Set<number>();
          newSet.add(ticketIdx);
          return newSet;
        });

        // Send the ticket
        try {
          this.streamManager.withNewStream<ce131.ClientHandler<typeof ce131.STREAM_KIND_PROXY_TO_ALL>>(
            peerInfo.peerRef,
            ce131.STREAM_KIND_PROXY_TO_ALL,
            (handler, sender) => {
              logger.log`[${peerInfo.peerId}] <-- Sending ticket for epoch ${epochIndex}`;
              handler.sendTicket(sender, epochIndex, ticket);
              sentCount++;
              return OK;
            },
          );
        } catch (e) {
          logger.warn`[${peerInfo.peerId}] Failed to send ticket for epoch ${epochIndex}: ${e}`;
        }
      }
    }

    logger.log`[maintain] Sent ${sentCount} tickets`;
  }

  /**
   * Add a ticket to the pending queue for distribution.
   * Clears pending tickets when epoch changes.
   * Deduplicates tickets based on signature.
   */
  addTicket(epochIndex: Epoch, ticket: SignedTicket) {
    // Check if epoch changed - if so, clear old tickets
    if (this.currentEpoch !== null && this.currentEpoch !== epochIndex) {
      logger.log`[addTicket] Epoch changed from ${this.currentEpoch} to ${epochIndex}, clearing ${this.pendingTickets.length} old tickets`;
      this.pendingTickets = [];
      // Clear aux data for all peers
      for (const peerInfo of this.connections.getConnectedPeers()) {
        this.connections.withAuxData(peerInfo.peerId, TICKET_AUX, () => new Set<number>());
      }
    }

    this.currentEpoch = epochIndex;

    // Deduplicate: check if ticket with same signature already exists
    // Compare signatures by converting to hex strings
    const signatureHex = Array.from(ticket.signature.raw)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const isDuplicate = this.pendingTickets.some(
      (pending) =>
        pending.epochIndex === epochIndex &&
        Array.from(pending.ticket.signature.raw)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("") === signatureHex,
    );

    if (!isDuplicate) {
      this.pendingTickets.push({ epochIndex, ticket });
      logger.log`[addTicket] Added ticket for epoch ${epochIndex}, total: ${this.pendingTickets.length}`;
    }
  }

  private onTicketReceived(epochIndex: Epoch, ticket: SignedTicket) {
    logger.info`Received ticket for epoch ${epochIndex}, attempt ${ticket.attempt}`;
    // Add to pending queue for potential re-distribution
    this.addTicket(epochIndex, ticket);
  }
}
