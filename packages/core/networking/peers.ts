import type { ReadableWritablePair } from "node:stream/web";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { OK, Opaque } from "@typeberry/utils";

/** Peer connection details. */
export type PeerAddress = {
  /** IPV4 peer address */
  host: string;
  /** port number */
  port: number;
};

/** Communication stream. */
export interface Stream extends ReadableWritablePair<Uint8Array, Uint8Array> {
  /** Add a callback to be notified about stream errors. */
  addOnError(onError: (e: unknown) => void): void;
  /** Unique stream identifier. */
  streamId: number;
  /** Destroy the stream. */
  destroy(): Promise<void>;
}

/** Peer id. */
export type PeerId = Opaque<string, "peerId">;

/** Peer interface. */
export interface Peer {
  /** ID unique per connection. */
  connectionId: string;
  /** Connection address. */
  address: PeerAddress;
  /** Peer id (alpn of the cert). */
  id: PeerId;
  /** Peer's public key. */
  key: Ed25519Key;

  /** Add a handler for when others open new streams with us. */
  addOnIncomingStream(streamCallback: StreamCallback): void;

  /** Initiate a new stream. */
  openStream(): Stream;

  /** Close the connection to that peer. */
  disconnect(): Promise<void>;
}

/**
 * Function called when a new stream is opened.
 *
 * NOTE: the callbacks are required to return `OK` to indicate,
 * that any asynchronous work has to be handled separately
 * with all possible exceptions handled.
 */
export type StreamCallback<S extends Stream = Stream> = (onPeer: S) => OK;
/**
 * Function called when a new peer is connected or disconnected.
 *
 * NOTE the callbacks are required to return `OK` to indicate,
 * that any asynchronous work has to be handled separately
 * with all possible exceptions handled.
 */
export type PeerCallback<T extends Peer> = (onPeer: T) => OK;

const logger = Logger.new(import.meta.filename, "peers");

/** Peer ID and address in a standardized format. */
function displayId(peer: Peer) {
  return `${peer.id}@${peer.address.host}:${peer.address.port}`;
}

/** Peer management. */
export class Peers<T extends Peer> {
  private readonly onPeerConnected: PeerCallback<T>[] = [];
  private readonly onPeerDisconnected: PeerCallback<T>[] = [];

  private readonly peers: Map<PeerId, Peer> = new Map();

  isConnected(id: PeerId) {
    return this.peers.has(id);
  }

  peerConnected(peer: T) {
    logger.info(`💡 Peer ${displayId(peer)} connected.`);
    const oldPeerData = this.peers.get(peer.id);
    if (oldPeerData !== undefined) {
      // TODO [ToDr] replacing old connection?
      logger.warn("Replacing older connection.");
    }
    this.peers.set(peer.id, peer);
    for (const callback of this.onPeerConnected) {
      callback(peer);
    }
  }

  peerDisconnected(peer: T) {
    logger.info(`⚡︎Peer ${displayId(peer)} disconnected.`);
    this.peers.delete(peer.id);
    for (const callback of this.onPeerDisconnected) {
      callback(peer);
    }
  }

  addOnPeerConnected(cb: PeerCallback<T>) {
    this.onPeerConnected.push(cb);
    return () => {
      const idx = this.onPeerConnected.indexOf(cb);
      if (idx !== -1) {
        this.onPeerConnected.splice(idx, 1);
      }
    };
  }

  addOnPeerDisconnected(cb: PeerCallback<T>) {
    this.onPeerDisconnected.push(cb);
    return () => {
      const idx = this.onPeerDisconnected.indexOf(cb);
      if (idx !== -1) {
        this.onPeerDisconnected.splice(idx, 1);
      }
    };
  }
}
