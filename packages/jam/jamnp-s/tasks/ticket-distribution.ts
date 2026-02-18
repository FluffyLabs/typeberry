import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { OK } from "@typeberry/utils";
import type { AuxData, Connections } from "../peers.js";
import { ce131 } from "../protocol/index.js";
import type { StreamManager } from "../stream-manager.js";

const logger = Logger.new(import.meta.filename, "net:tickets");

/** Aux data shape: tracks epoch and which ticket indices have been sent to each peer */
type TicketAuxData = {
  epoch: Epoch;
  seen: Set<number>;
};

/** Aux data to track which tickets have been sent to each peer (using indices) */
const TICKET_AUX: AuxData<TicketAuxData> = {
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
  static start(streamManager: StreamManager, connections: Connections, chainSpec: ChainSpec) {
    const task = new TicketDistributionTask(streamManager, connections);

    // server mode: receive tickets from peers
    streamManager.registerIncomingHandlers(
      new ce131.ServerHandler(chainSpec, ce131.STREAM_KIND_PROXY_TO_ALL, (epochIndex, ticket) => {
        task.onTicketReceived(epochIndex, ticket);
      }),
    );

    // client mode: send tickets to peers
    streamManager.registerOutgoingHandlers(new ce131.ClientHandler(chainSpec, ce131.STREAM_KIND_PROXY_TO_ALL));

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
    if (this.currentEpoch === null) {
      return; // No tickets to distribute yet
    }

    /** `this` is mutable and TS can't narrow this.currentEpoch inside the callback closure */
    const currentEpoch = this.currentEpoch;

    // Iterate through all pending tickets
    for (let ticketIdx = 0; ticketIdx < this.pendingTickets.length; ticketIdx++) {
      const { epochIndex, ticket } = this.pendingTickets[ticketIdx];

      // Try to send to each connected peer
      for (const peerInfo of this.connections.getConnectedPeers()) {
        this.connections.withAuxData(peerInfo.peerId, TICKET_AUX, (maybeAux) => {
          const shouldReset = maybeAux === undefined || maybeAux.epoch !== currentEpoch;
          const aux = shouldReset ? { epoch: currentEpoch, seen: new Set<number>() } : maybeAux;

          if (peerInfo.peerRef === null) {
            return aux;
          }

          // Check if we already sent this ticket to this peer
          if (aux.seen.has(ticketIdx)) {
            return aux; // Already sent
          }

          // Send the ticket - only mark as sent after successful send
          try {
            this.streamManager.withNewStream<ce131.ClientHandler<typeof ce131.STREAM_KIND_PROXY_TO_ALL>>(
              peerInfo.peerRef,
              ce131.STREAM_KIND_PROXY_TO_ALL,
              (handler, sender) => {
                logger.trace`[${peerInfo.peerId}] <-- Sending ticket for epoch ${epochIndex}`;
                handler.sendTicket(sender, epochIndex, ticket);
                return OK;
              },
            );

            // Mark as sent only after successful send, so failed sends will be retried
            aux.seen.add(ticketIdx);
          } catch (e) {
            logger.warn`[${peerInfo.peerId}] Failed to send ticket for epoch ${epochIndex}: ${e}`;
          }
          return aux;
        });
      }
    }
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
      // Note: We don't need to clear aux data for all peers here.
      // The aux data contains the epoch, so maintainDistribution will lazily
      // reset it when it detects an epoch mismatch. This handles both connected
      // and disconnected peers correctly.
    }

    this.currentEpoch = epochIndex;

    /**
     * Deduplicate: check if a ticket with the same signature already exists
     *
     * Here we are risking "poisoning" the local pendingTickets - i.e:
     *  1. The adversary sees a signature and swaps the ticket attempt to something different.
     *  2. This creates an invalid ticket, but prevents a valid ticket with the same signature from being included and distributed.
     *
     * TODO [MaSi]: The poisoning risk should be fixed during implementation of ticket validation.
     */
    const isDuplicate = this.pendingTickets.some(
      (pending) => pending.epochIndex === epochIndex && pending.ticket.signature.isEqualTo(ticket.signature),
    );

    if (!isDuplicate) {
      this.pendingTickets.push({ epochIndex, ticket });
      logger.info`[addTicket] Added ticket for epoch ${epochIndex}, total: ${this.pendingTickets.length}`;
    }
  }

  private onTicketReceived(epochIndex: Epoch, ticket: SignedTicket) {
    logger.trace`Received ticket for epoch ${epochIndex}, attempt ${ticket.attempt}`;
    // Add to pending queue for potential re-distribution
    this.addTicket(epochIndex, ticket);
  }
}
