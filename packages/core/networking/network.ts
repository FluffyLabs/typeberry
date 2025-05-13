import {Peer, PeerAddress} from "./peers";

export interface Network {
  start(): Promise<void>;

  stop(): Promise<void>;

  onPeerConnect(onPeer: (p: Peer) => void): void;

  onPeerDisconnect(onPeer: (p: Peer) => void): void;

  dial(address: PeerAddress): Promise<Peer>;
}
