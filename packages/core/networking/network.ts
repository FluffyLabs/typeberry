import type { Peer, PeerAddress, PeerCallback } from "./peers.js";

/** Peer dialing options. */
export type DialOptions = {
  /** Verify the expected peer name after connection. */
  verifyName?: string;
  /** Abort connection on demand. */
  signal?: AbortSignal;
};

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

  /** Initiate a new connection to some peer. */
  dial(address: PeerAddress, options: DialOptions): Promise<T>;
}
