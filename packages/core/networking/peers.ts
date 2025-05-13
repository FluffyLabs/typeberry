import {Ed25519Key} from "@typeberry/block";
import {Logger} from "@typeberry/logger";
import {ReadableWritablePair} from "node:stream/web";

/** Peer connection details. */
export type PeerAddress = {
  /** IPV4 peer address */
  host: string;
  /** port number */
  port: number;
};

/** Communication stream. */
export interface Stream extends ReadableWritablePair<Uint8Array, Uint8Array> {}

/** Peer interface. */
export interface Peer {
  /** ID unique per connection. */
  connectionId: string,
  /** Connection address. */
  address: PeerAddress,
  /** Peer id (alpn of the cert). */
  id: string;
  /** Peer's public key. */
  key: Ed25519Key;

  /** Add a handler for when new streams are being opened. */
  addOnStreamOpen(streamCallback: StreamCallback): void;

  /** Initiate a new stream. */
  openStream(): Stream;
}

type PeerCallback = (onPeer: Peer) => void;
type StreamCallback = (onPeer: Stream) => void;

const logger = Logger.new(__filename, "net:peers");

export class Peer {
}

/** Peer management. */
export class Peers {
  private readonly onPeerConnected: PeerCallback[] = [];
  private readonly onPeerDisconnected: PeerCallback[] = [];

  private readonly peers: Map<string, Peer> = new Map();

  public peerConnected(peer: Peer) {
    logger.info(`💡 Peer ${peer.id} connected.`);
    const oldPeerData = this.peers.get(peer.connectionId);
    if (oldPeerData !== undefined) {
      // TODO [ToDr] replacing old connection?
      logger.warn('Replacing older connection.');
    }
    this.peers.set(peer.connectionId, peer);
    this.onPeerConnected.forEach(x => x(peer));
  }

  public peerDisconnected(peer: Peer) {
    logger.info(`⚡︎Peer ${peer.id} disconnected.`);
    this.peers.delete(peer.connectionId);
    this.onPeerDisconnected.forEach(x => x(peer));
  }

  public addOnPeerConnected(cb: PeerCallback) {
    this.onPeerConnected.push(cb);
  }

  public addOnPeerDisconnected(cb: PeerCallback) {
    this.onPeerDisconnected.push(cb);
  }
}
