import type { Peer, PeerAddress, Peers } from "./peers.js";

/** Peer dialing options. */
export type DialOptions = {
  /** Verify the expected peer name after connection. */
  verifyName?: string;
  /** Abort connection on demand. */
  signal?: AbortSignal;
};

/** Networking abstraction. */
export interface Network<T extends Peer> {
  /** Peers management. */
  peers: Peers<T>;

  /** Start networking interface. */
  start(): Promise<void>;

  /** Stop networking interface and terminate existing connections. */
  stop(): Promise<void>;

  /** Initiate a new connection to some peer. */
  dial(address: PeerAddress, options: DialOptions): Promise<T>;
}
