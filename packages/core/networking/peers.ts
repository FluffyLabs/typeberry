import type { ReadableWritablePair } from "node:stream/web";
import type { PeerAddress, PeerId } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { OK } from "@typeberry/utils";

export type { PeerAddress, PeerId } from "@typeberry/config";

/**
 * Error callback maybe be triggered multiple times.
 *
 * In case of an exception result we will usually see a sequence of:
 * 1. Exception
 * 2. LocalClose (since we detected exception and want to close connection)
 * 3. RemoteClose (since the remote peer detected the exceptional behavior as well)
 *
 * However in case of clean disconnects, we may see just local close or remote close
 * first in case it was either us or them closing the connection.
 *
 * `LocalClose` is also trigerred mutliple times (readable stream, writeable stream,
 * connection). If that's too much, we can tone it down in the future.
 */
export enum StreamErrorKind {
  /** An error or closing event that originates locally. */
  LocalClose = 0,
  /** Remote peer triggering close event. */
  RemoteClose = 1,
  /** Some exceptional behavior on the stream. */
  Exception = 2,
}

/** The callback that should be triggered when an error/close on stream occurs. */
export type StreamErrorCallback = (e: unknown, kind: StreamErrorKind) => void;

/** Communication stream. */
export interface Stream extends ReadableWritablePair<Uint8Array, Uint8Array> {
  /** Add a callback to be notified about stream errors. */
  addOnError(onError: StreamErrorCallback): void;
  /** Unique stream identifier. */
  streamId: number;
  /** Destroy the stream. */
  destroy(): Promise<void>;
}

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
export type StreamCallback<S extends Stream = Stream> = (onStream: S) => OK;
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

type Unsubscribe = () => void;

export interface Peers<T extends Peer> {
  /** Check that peer with given id is currently connected. */
  isConnected(id: PeerId): boolean;
  /** Get number of connected peers. */
  noOfConnectedPeers(): number;

  /** Add a callback triggered every time new peers is connected. */
  onPeerConnected(cb: PeerCallback<T>): Unsubscribe;
  /** Add a callback triggered every time a peer is disconnected. */
  onPeerDisconnected(cb: PeerCallback<T>): Unsubscribe;
}

/** Peer management. */
export class PeersManagement<T extends Peer> implements Peers<T> {
  private readonly _onPeerConnected: PeerCallback<T>[] = [];
  private readonly _onPeerDisconnected: PeerCallback<T>[] = [];

  private readonly peers: Map<PeerId, Peer> = new Map();

  peerConnected(peer: T) {
    logger.info`💡 Peer ${displayId(peer)} connected.`;
    const oldPeerData = this.peers.get(peer.id);
    if (oldPeerData !== undefined) {
      // TODO [ToDr] replacing old connection?
      logger.warn`Replacing older connection.`;
    }
    this.peers.set(peer.id, peer);
    for (const callback of this._onPeerConnected) {
      callback(peer);
    }
  }

  peerDisconnected(peer: T) {
    logger.info`⚡︎Peer ${displayId(peer)} disconnected.`;
    this.peers.delete(peer.id);
    for (const callback of this._onPeerDisconnected) {
      callback(peer);
    }
  }

  isConnected(id: PeerId) {
    return this.peers.has(id);
  }

  noOfConnectedPeers() {
    return this.peers.size;
  }

  onPeerConnected(cb: PeerCallback<T>) {
    this._onPeerConnected.push(cb);
    return () => {
      const idx = this._onPeerConnected.indexOf(cb);
      if (idx !== -1) {
        this._onPeerConnected.splice(idx, 1);
      }
    };
  }

  onPeerDisconnected(cb: PeerCallback<T>) {
    this._onPeerDisconnected.push(cb);
    return () => {
      const idx = this._onPeerDisconnected.indexOf(cb);
      if (idx !== -1) {
        this._onPeerDisconnected.splice(idx, 1);
      }
    };
  }
}
