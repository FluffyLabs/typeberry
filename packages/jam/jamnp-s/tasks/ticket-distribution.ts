import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { DenyTicketsValidator, PendingTicketPool, type TicketValidator } from "@typeberry/ticket-pool";
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
 *
 * Incoming tickets from peers are first run through a {@link TicketValidator};
 * only validated tickets are added to the redistribution pool. The default
 * validator denies everything, so callers must wire a real one via
 * {@link setTicketValidator} before any networked ticket can be redistributed.
 */
export class TicketDistributionTask {
  static start(streamManager: StreamManager, connections: Connections, chainSpec: ChainSpec) {
    const task = new TicketDistributionTask(streamManager, connections);

    // server mode: receive tickets from peers
    streamManager.registerIncomingHandlers(
      ce131.ServerHandler.new(chainSpec, ce131.STREAM_KIND_PROXY_TO_ALL, (epochIndex, ticket) => {
        task.onTicketReceived(epochIndex, ticket);
      }),
    );

    // client mode: send tickets to peers
    streamManager.registerOutgoingHandlers(ce131.ClientHandler.new(chainSpec, ce131.STREAM_KIND_PROXY_TO_ALL));

    return task;
  }

  private readonly pool = new PendingTicketPool();
  private validator: TicketValidator = new DenyTicketsValidator();

  private constructor(
    private readonly streamManager: StreamManager,
    private readonly connections: Connections,
  ) {}

  /**
   * Should be called periodically to distribute pending tickets to connected peers.
   */
  maintainDistribution() {
    const currentEpoch = this.pool.currentEpoch;
    if (currentEpoch === null) {
      return;
    }

    const tickets = this.pool.getTickets();
    for (let ticketIdx = 0; ticketIdx < tickets.length; ticketIdx++) {
      const { epochIndex, ticket } = tickets[ticketIdx];

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
   * Add a ticket to the redistribution pool.
   * Clears pending tickets when epoch changes.
   * Deduplicates tickets based on signature.
   */
  addTicket(epochIndex: Epoch, ticket: SignedTicket) {
    this.pool.addTicket(epochIndex, ticket);
  }

  /**
   * Replace the redistribution pool for the given epoch with the supplied tickets.
   * Used when the authorship worker dumps the authoritative pool on an epoch boundary.
   */
  replacePool(epochIndex: Epoch, tickets: readonly SignedTicket[]) {
    this.pool.replace(epochIndex, tickets);
  }

  /**
   * Register the validator that decides whether tickets received from peers should be
   * accepted (and therefore redistributed). The default is {@link DenyTicketsValidator},
   * so the caller must install a real validator for any peer ticket to make it through.
   */
  setTicketValidator(validator: TicketValidator) {
    this.validator = validator;
  }

  private onTicketReceived(epochIndex: Epoch, ticket: SignedTicket) {
    logger.trace`Received ticket for epoch ${epochIndex}, attempt ${ticket.attempt}`;
    const validator = this.validator;
    // Wrap with Promise.resolve().then() so a synchronous throw inside the validator
    // funnels into the same .catch() as an async rejection.
    Promise.resolve()
      .then(() => validator.validate(epochIndex, [ticket]))
      .then((result) => {
        if (result.isOk) {
          this.addTicket(epochIndex, ticket);
        } else {
          logger.trace`Dropping ticket for epoch ${epochIndex}: ${result.error}`;
        }
      })
      .catch((error) => {
        logger.error`Error validating ticket for epoch ${epochIndex}, attempt ${ticket.attempt}: ${error}`;
      });
  }
}
