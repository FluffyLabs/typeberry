import type { Peer, PeerAddress } from "./peers.js";

export interface Network {
  start(): Promise<void>;

  stop(): Promise<void>;

  onPeerConnect(onPeer: (p: Peer) => void): void;

  onPeerDisconnect(onPeer: (p: Peer) => void): void;

  dial(address: PeerAddress): Promise<Peer>;
}
