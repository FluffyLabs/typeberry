import type { ReadableWritablePair } from "node:stream/web";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { OK } from "@typeberry/utils";

/** Peer connection details. */
export type PeerAddress = {
  /** IPV4 peer address */
  host: string;
  /** port number */
  port: number;
};

/** Communication stream. */
export interface Stream extends ReadableWritablePair<Uint8Array, Uint8Array> {
  destroy(): Promise<void>;
}

/** Peer interface. */
export interface Peer {
  /** ID unique per connection. */
  connectionId: string;
  /** Connection address. */
  address: PeerAddress;
  /** Peer id (alpn of the cert). */
  id: string;
  /** Peer's public key. */
  key: Ed25519Key;

  /** Add a handler for when new streams are being opened. */
  addOnStreamOpen(streamCallback: StreamCallback): void;

  /** Initiate a new stream. */
  openStream(): Stream;

  /** Close the connection to that peer. */
  disconnect(): Promise<void>;
}

/**
 * Function called when a new stream is opened.
 *
 * NOTE the callbacks are required to return `OK` to indicate,
 * that any asynchronous work has to be handled separately
 * with all possible exceptions handled.
 */
export type StreamCallback = (onPeer: Stream) => OK;
/**
 * Function called when a new peer is connected or disconnected.
 *
 * NOTE the callbacks are required to return `OK` to indicate,
 * that any asynchronous work has to be handled separately
 * with all possible exceptions handled.
 */
export type PeerCallback<T extends Peer> = (onPeer: T) => OK;

const logger = Logger.new(import.meta.filename, "net:peers");

/** Peer management. */
export class Peers<T extends Peer> {
  private readonly onPeerConnected: PeerCallback<T>[] = [];
  private readonly onPeerDisconnected: PeerCallback<T>[] = [];

  private readonly peers: Map<string, Peer> = new Map();

  public peerConnected(peer: T) {
    logger.info(`💡 Peer ${peer.id} connected.`);
    const oldPeerData = this.peers.get(peer.connectionId);
    if (oldPeerData !== undefined) {
      // TODO [ToDr] replacing old connection?
      logger.warn("Replacing older connection.");
    }
    this.peers.set(peer.connectionId, peer);
    for (const callback of this.onPeerConnected) {
      callback(peer);
    }
  }

  public peerDisconnected(peer: T) {
    logger.info(`⚡︎Peer ${peer.id} disconnected.`);
    this.peers.delete(peer.connectionId);
    for (const callback of this.onPeerDisconnected) {
      callback(peer);
    }
  }

  public addOnPeerConnected(cb: PeerCallback<T>) {
    this.onPeerConnected.push(cb);
    return () => {
      const idx = this.onPeerConnected.indexOf(cb);
      if (idx !== -1) {
        this.onPeerConnected.splice(idx, 1);
      }
    };
  }

  public addOnPeerDisconnected(cb: PeerCallback<T>) {
    this.onPeerDisconnected.push(cb);
    return () => {
      const idx = this.onPeerDisconnected.indexOf(cb);
      if (idx !== -1) {
        this.onPeerDisconnected.splice(idx, 1);
      }
    };
  }
}
