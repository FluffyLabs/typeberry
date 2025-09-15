import {
  type BlockView,
  Header,
  type HeaderHash,
  type HeaderView,
  type TimeSlot,
  tryAsTimeSlot,
} from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database";
import { blake2b, WithHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { Peer, PeerId } from "@typeberry/networking";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { assertNever, OK } from "@typeberry/utils";
import type { AuxData, Connections } from "../peers.js";
import { BlockSequenceError, handleGetBlockSequence } from "../protocol/ce-128-block-request.js";
import { ce128, type StreamId, up0 } from "../protocol/index.js";
import type { StreamManager } from "../stream-manager.js";
import { handleAsyncErrors } from "../utils.js";

export const SYNC_AUX: AuxData<SyncAux> = {
  id: Symbol("sync"),
};

type SyncAux = {
  finalBlockHash: HeaderHash;
  finalBlockSlot: TimeSlot;
  bestHeader: WithHash<HeaderHash, Header> | null;
};

const logger = Logger.new(import.meta.filename, "net:sync");

/**
 * Maximal number of blocks we will send as a response to CE128.
 */
const MAX_BLOCK_SEQUENCE = 128;

export class SyncTask {
  static start(
    spec: ChainSpec,
    streamManager: StreamManager,
    connections: Connections,
    blocks: BlocksDb,
    // TODO [ToDr] Use listener instead of a callback maybe?
    onNewBlocks: (blocks: BlockView[], peerId: PeerId) => void,
  ) {
    const syncTask = new SyncTask(spec, streamManager, connections, blocks, onNewBlocks);

    const getPeerForStream = (streamId: StreamId) => {
      // NOTE [ToDr] Needing to query stream manager for a peer might be a bit
      // wasteful, since we probably know the peer when we dispatch the
      // stream message, however it's nice that the current abstraction of
      // streams does not know anything about peers. Revisit if it gets ugly.

      // retrieve a peer for that stream
      return streamManager.getPeer(streamId);
    };

    const up0Handler = new up0.Handler(
      spec,
      () => syncTask.getUp0Handshake(),
      (streamId, ann) => {
        const peer = getPeerForStream(streamId);
        if (peer !== null) {
          syncTask.onUp0Annoucement(peer, ann);
        }
      },
      (streamId, handshake) => {
        const peer = getPeerForStream(streamId);
        if (peer !== null) {
          syncTask.onUp0Handshake(peer, handshake);
        }
      },
    );

    // server mode
    streamManager.registerIncomingHandlers(up0Handler);
    streamManager.registerIncomingHandlers(
      new ce128.ServerHandler(spec, (streamId, hash, direction, maxBlocks) => {
        const peer = getPeerForStream(streamId);
        if (peer !== null) {
          return syncTask.handleGetBlockSequence(peer, hash, direction, maxBlocks);
        }
        return [];
      }),
    );

    // client mode
    streamManager.registerOutgoingHandlers(up0Handler);
    streamManager.registerOutgoingHandlers(new ce128.ClientHandler(spec));

    return syncTask;
  }

  // Other's best header hash with timeslot
  private othersBest: up0.HashAndSlot;

  private constructor(
    private readonly spec: ChainSpec,
    private readonly streamManager: StreamManager,
    private readonly connections: Connections,
    private readonly blocks: BlocksDb,
    private readonly onNewBlocks: (blocks: BlockView[], peer: PeerId) => void,
  ) {
    const ourBestHash = blocks.getBestHeaderHash();
    // Get best block view
    const ourBestBlock = blocks.getHeader(ourBestHash);
    if (ourBestBlock === null) {
      throw new Error(`Best header ${ourBestHash} missing in the database?`);
    }
    this.othersBest = up0.HashAndSlot.create({
      hash: ourBestHash,
      slot: ourBestBlock.timeSlotIndex.materialize(),
    });
  }

  private onUp0Handshake(peer: Peer, handshake: up0.Handshake) {
    const { hash, slot } = handshake.final;
    this.connections.withAuxData(peer.id, SYNC_AUX, (aux) => {
      if (aux === undefined) {
        return {
          finalBlockHash: hash,
          finalBlockSlot: slot,
          bestHeader: null,
        };
      }

      aux.finalBlockHash = hash;
      aux.finalBlockSlot = slot;
      aux.bestHeader = null;
      return aux;
    });

    if (this.othersBest.slot < slot) {
      this.othersBest = handshake.final;
    }
  }

  private onUp0Annoucement(peer: Peer, announcement: up0.Announcement) {
    const { hash, slot } = announcement.final;
    const bestHeader = hashHeader(announcement.header, this.spec);
    logger.info(`[${peer.id}] --> Received new header #${announcement.header.timeSlotIndex}: ${bestHeader.hash}`);

    // NOTE [ToDr] Instead of having `Connections` store aux data perhaps
    // we should maintain that directly? However that would require
    // listening to peers connected/disconnected to perfrom some cleanups
    // and extra persistence.
    //
    // update the peer info
    this.connections.withAuxData(peer.id, SYNC_AUX, (aux) => {
      if (aux === undefined) {
        return {
          finalBlockHash: hash,
          finalBlockSlot: slot,
          bestHeader,
        };
      }

      aux.finalBlockHash = hash;
      aux.finalBlockSlot = slot;
      aux.bestHeader = bestHeader;
      return aux;
    });

    // TODO [ToDr] This should take finality into account, which would
    // also indirectly do ancestry checks (i.e. we assume that the peer
    // is verifying that the best block is built on top of it's own
    // reported finalized block).
    //
    // now check if we should sync that block
    if (this.othersBest.slot < bestHeader.data.timeSlotIndex) {
      this.othersBest = up0.HashAndSlot.create({
        hash: bestHeader.hash,
        slot: bestHeader.data.timeSlotIndex,
      });
    }
  }

  private getUp0Handshake(): up0.Handshake {
    // TODO [ToDr] We don't have finality yet,
    // we just treat each produced block as instantly-finalized.
    const bestBlockHash = this.blocks.getBestHeaderHash();
    const bestHeader = this.blocks.getHeader(bestBlockHash);
    const timeSlot = bestHeader?.timeSlotIndex.materialize();
    const bestBlock = up0.HashAndSlot.create({
      hash: bestBlockHash,
      slot: timeSlot ?? tryAsTimeSlot(0),
    });

    return up0.Handshake.create({
      final: bestBlock,
      leafs: [],
    });
  }

  /**
   * Open a UP0 stream with given peer.
   *
   * This will automatically send a handshake as well.
   */
  openUp0(peer: Peer) {
    this.streamManager.withNewStream<up0.Handler>(peer, up0.STREAM_KIND, (handler, sender) => {
      handler.sendHandshake(sender);
      return OK;
    });
  }

  /** Broadcast header we have seen or produced to our peers. */
  broadcastHeader(header: WithHash<HeaderHash, HeaderView>) {
    const slot = header.data.timeSlotIndex.materialize();
    const annoucement = up0.Announcement.create({
      header: header.data.materialize(),
      final: up0.HashAndSlot.create({
        hash: header.hash,
        slot,
      }),
    });
    // TODO [ToDr] we currently gossip to everyone, but we probably should:
    // 1. Gossip to peers in batches (sqrt(n) peers first?)
    // 2. Gossip only to the peers that don't know about that header yet.
    const peers = this.connections.getConnectedPeers();
    for (const peerInfo of peers) {
      this.streamManager.withStreamOfKind<up0.Handler>(peerInfo.peerId, up0.STREAM_KIND, (handler, sender) => {
        logger.log(`[${peerInfo.peerId}] <-- Broadcasting new header #${slot}: ${header.hash}`);
        handler.sendAnnouncement(sender, annoucement);
        return OK;
      });
    }
  }

  private handleGetBlockSequence(
    peer: Peer,
    startHash: HeaderHash,
    direction: ce128.Direction,
    maxBlocks: U32,
  ): BlockView[] {
    const limit = tryAsU32(Math.min(maxBlocks, MAX_BLOCK_SEQUENCE));
    const res = handleGetBlockSequence(this.spec, this.blocks, startHash, direction, limit);
    if (res.isOk) {
      return res.ok;
    }

    if (res.error === BlockSequenceError.BlockOnFork) {
      // seems that peer is requesting syncing a fork from us, let's bail.
      logger.warn(`[${peer.id}] <-- Invalid block sequence request: ${startHash} is on a fork.`);
      return [];
    }

    if (res.error === BlockSequenceError.NoStartBlock) {
      // we don't know about that block at all, so let's just bail.
      // we should probably penalize the peer for sending BS?
      logger.warn(`[${peer.id}] <-- Invalid block sequence request: ${startHash} missing header or extrinsic.`);
      return [];
    }

    assertNever(res.error);
  }

  /** Should be called periodically to request best seen blocks from other peers. */
  maintainSync() {
    // figure out where we are at
    const ourBestHash = this.blocks.getBestHeaderHash();
    const ourBestHeader = this.blocks.getHeader(ourBestHash);
    const peerCount = this.connections.getPeerCount();
    if (ourBestHeader === null) {
      return {
        kind: SyncResult.OurBestHeaderMissing,
      };
    }

    const ourBestSlot = ourBestHeader.timeSlotIndex.materialize();
    // figure out where others are at
    const othersBest = this.othersBest;
    const blocksToSync = othersBest.slot - ourBestSlot;

    logger.trace(`Our best. ${ourBestSlot}. Best seen: ${othersBest.slot}`);
    if (blocksToSync < 1) {
      this.connections.getPeerCount();
      logger.trace(`No new blocks. ${peerCount} peers.`);
      return {
        kind: SyncResult.NoNewBlocks,
        ours: ourBestSlot,
        theirs: othersBest.slot,
      };
    }

    const requested: RequestedBlocks[] = [];

    logger.log(`Sync ${blocksToSync} blocks from ${peerCount} peers.`);
    // NOTE [ToDr] We might be requesting the same blocks from many peers
    // which isn't very optimal, but for now: 🤷
    //
    // find peers that might have that block
    for (const peerInfo of this.connections.getConnectedPeers()) {
      const auxData = this.connections.getAuxData(peerInfo.peerId, SYNC_AUX);
      // no aux data for that peer or peer not connected?
      if (auxData === undefined || peerInfo.peerRef === null) {
        continue;
      }

      const bestSlot = auxData.bestHeader !== null ? auxData.bestHeader.data.timeSlotIndex : auxData.finalBlockSlot;
      const bestHash = auxData.bestHeader !== null ? auxData.bestHeader.hash : auxData.finalBlockHash;
      // the peer doesn't have anything new for us
      if (bestSlot <= ourBestSlot) {
        continue;
      }

      // add some details for statistics.
      requested.push({
        peerId: peerInfo.peerId,
        theirs: bestSlot,
        count: bestSlot - ourBestSlot,
      });

      // request as much blocks from that peer as possible.
      this.streamManager.withNewStream<ce128.ClientHandler>(peerInfo.peerRef, ce128.STREAM_KIND, (handler, sender) => {
        handleAsyncErrors(
          async () => {
            logger.log(`Fetching blocks from ${peerInfo.peerId}.`);
            const blocks = await handler.requestBlockSequence(
              sender,
              bestHash,
              ce128.Direction.DescIncl,
              tryAsU32(bestSlot - ourBestSlot),
            );
            blocks.reverse();
            this.onNewBlocks(blocks, peerInfo.peerId);
          },
          (e) => {
            logger.warn(`[${peerInfo.peerId}] --> requesting blocks to import: ${e}`);
          },
        );
        return OK;
      });
    }

    return {
      kind: SyncResult.BlocksRequested,
      ours: ourBestSlot,
      requested,
    };
  }
}

/** Some extra details about how maintaining sync went. */
export enum SyncResult {
  /** We didn't find our best header? */
  OurBestHeaderMissing = 1,
  /** There is no new blocks that we can sync. */
  NoNewBlocks = 2,
  /** Sent request to some peers. */
  BlocksRequested = 3,
}

/** Information about blocks requested from other peers. */
export type RequestedBlocks = {
  /** Peer id we sent the request to. */
  peerId: PeerId;
  /* Their best time slot. */
  theirs: TimeSlot;
  /** Number of blocks requested. */
  count: number;
};

function hashHeader(header: Header, spec: ChainSpec): WithHash<HeaderHash, Header> {
  const encoded = Encoder.encodeObject(Header.Codec, header, spec);
  return new WithHash(blake2b.hashBytes(encoded).asOpaque(), header);
}
