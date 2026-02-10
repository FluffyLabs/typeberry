import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Logger } from "@typeberry/logger";
import { OK } from "@typeberry/utils";
import type { Connections } from "../peers.js";
import { ce131 } from "../protocol/index.js";
import type { StreamManager } from "../stream-manager.js";

const logger = Logger.new(import.meta.filename, "net:tickets");

/**
 * Manages distribution of Safrole tickets to connected peers.
 *
 * Currently uses CE-132 (proxy-to-all) for direct broadcast to all peers.
 * CE-131 (generator-to-proxy) routing will be added later.
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

  private constructor(
    private readonly streamManager: StreamManager,
    private readonly connections: Connections,
  ) {}

  /**
   * Distribute a ticket to all connected peers via CE-132.
   */
  distributeTicket(epochIndex: Epoch, ticket: SignedTicket) {
    const peers = this.connections.getConnectedPeers();
    for (const peerInfo of peers) {
      if (peerInfo.peerRef === null) {
        continue;
      }
      try {
        this.streamManager.withNewStream<ce131.ClientHandler<typeof ce131.STREAM_KIND_PROXY_TO_ALL>>(
          peerInfo.peerRef,
          ce131.STREAM_KIND_PROXY_TO_ALL,
          (handler, sender) => {
            logger.log`[${peerInfo.peerId}] <-- Sending ticket for epoch ${epochIndex}`;
            handler.sendTicket(sender, epochIndex, ticket);
            return OK;
          },
        );
      } catch (e) {
        logger.warn`[${peerInfo.peerId}] Failed to send ticket for epoch ${epochIndex}: ${e}`;
      }
    }
  }

  private onTicketReceived(epochIndex: Epoch, ticket: SignedTicket) {
    logger.info`Received ticket for epoch ${epochIndex}, attempt ${ticket.attempt}`;
    // TODO: Store in ticket pool for inclusion in future blocks.
  }
}
