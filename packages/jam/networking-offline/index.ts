import type { BlockView, HeaderHash, HeaderView } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { type AuthorshipComms, protocol as authorshipProtocol } from "@typeberry/comms-authorship-network/protocol.js";
import { TicketsMessage } from "@typeberry/comms-authorship-network/tickets-message.js";
import type { WithHash } from "@typeberry/hash";
import {
  type NetworkingApi,
  type NetworkingInternal,
  protocol as networkingProtocol,
} from "@typeberry/jam-network/messages.js";
import { Listener } from "@typeberry/listener";
import { Channel } from "@typeberry/workers-api/channel.js";
import type { Port } from "@typeberry/workers-api/port.js";
import { startSameThread } from "@typeberry/workers-api/protocol.js";

/**
 * Programmatic handle for an offline networking worker.
 *
 * Inputs model messages received from peers. Events model messages which the
 * online networking worker would broadcast to peers.
 */
export class OfflineNetworking {
  /** Best-header announcements produced after successful imports. */
  readonly announcedHeaders = new Listener<WithHash<HeaderHash, HeaderView>>();
  /** Locally authored tickets which should be distributed to peers. */
  readonly announcedTickets = new Listener<TicketsMessage>();
  /** Authoritative ticket-pool snapshots produced on epoch boundaries. */
  readonly ticketPoolReplacements = new Listener<TicketsMessage>();
  private isFinished = false;

  private constructor(
    private readonly networkingComms: NetworkingInternal,
    private readonly authorshipComms: AuthorshipComms,
    /** Resolves after the offline networking protocol has finished. */
    readonly finished: Promise<void>,
  ) {}

  static start(networkingComms: NetworkingInternal, authorshipComms: AuthorshipComms): OfflineNetworking {
    let finish: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const offline = new OfflineNetworking(networkingComms, authorshipComms, finished);

    networkingComms.setOnNewHeader(async (header) => {
      offline.announcedHeaders.emit(header);
    });
    networkingComms.setOnFinish(async () => {
      offline.isFinished = true;
      offline.announcedHeaders.markDone();
      offline.announcedTickets.markDone();
      offline.ticketPoolReplacements.markDone();
      finish();
    });

    authorshipComms.setOnTickets(async (tickets) => {
      offline.announcedTickets.emit(tickets);
    });
    authorshipComms.setOnReplaceTicketPool(async (tickets) => {
      offline.ticketPoolReplacements.emit(tickets);
    });

    return offline;
  }

  /** Submit one block as though it had been received from a peer. */
  async submitBlock(block: BlockView): Promise<void> {
    await this.submitBlocks([block]);
  }

  /** Submit a batch of blocks as though it had been received from peers. */
  async submitBlocks(blocks: BlockView[]): Promise<void> {
    this.assertActive();
    await this.networkingComms.sendBlocks(blocks);
  }

  /**
   * Submit tickets as though they had been received from a peer.
   *
   * The result is the real authorship worker's validation decision for the
   * complete batch.
   */
  async submitTickets(epochIndex: TicketsMessage["epochIndex"], tickets: SignedTicket[]): Promise<boolean> {
    this.assertActive();
    return await this.authorshipComms.sendReceivedTickets(TicketsMessage.create({ epochIndex, tickets }));
  }

  private assertActive(): void {
    if (this.isFinished) {
      throw new Error("Offline networking has finished");
    }
  }
}

export type OfflineNetworkingWorker = {
  /** Node-facing side of the standard networking-worker protocol. */
  network: NetworkingApi;
  /** Programmatic replacement for network peer traffic. */
  offline: OfflineNetworking;
  /** Stop the offline worker and close its channels. */
  finish(): Promise<void>;
};

/**
 * Start a same-thread networking worker controlled through {@link OfflineNetworking}.
 *
 * The authorship port may lead to either a same-thread or a worker-thread
 * authorship module, so persistent and in-memory nodes exercise the same APIs.
 */
export function startOfflineNetworkingWorker(authorshipPort: Port): OfflineNetworkingWorker {
  const { api: network, internal } = startSameThread(networkingProtocol);
  const authorshipComms = Channel.rx(authorshipProtocol, authorshipPort);
  const offline = OfflineNetworking.start(internal, authorshipComms);
  let finishPromise: Promise<void> | null = null;

  return {
    network,
    offline,
    finish: () => {
      finishPromise ??= (async () => {
        try {
          await network.sendFinish();
          await offline.finished;
        } finally {
          network.destroy();
          authorshipComms.destroy();
        }
      })();
      return finishPromise;
    },
  };
}
