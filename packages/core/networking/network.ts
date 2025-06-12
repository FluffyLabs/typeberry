import type { Peer, PeerAddress, PeerCallback } from "./peers.js";

/** Networking abstraction. */
export interface Network<T extends Peer> {
  /** Start networking interface. */
  start(): Promise<void>;

  /** Stop networking interface and terminate existing connections. */
  stop(): Promise<void>;

  /** Add a callback invoked every time a peer is connected. */
  onPeerConnect(onPeer: PeerCallback<T>): void;

  /** Add a callback invoked every time a peer is disconnected. */
  onPeerDisconnect(onPeer: PeerCallback<T>): void;

  /**
   * Initiate a new connection to some peer.
   *
   * TODO [ToDr] should prolly support a timeout.
   */
  dial(address: PeerAddress): Promise<T>;
}
