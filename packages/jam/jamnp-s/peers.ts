import { setTimeout } from "node:timers/promises";
import type { Network, Peer, PeerAddress, PeerId } from "@typeberry/networking";
import { OK } from "@typeberry/utils";

/** Bootnode class represents a single contact point in the network */
export class Bootnode implements PeerAddress {
  constructor(
    /** Network address derived from the node's cryptographic public key (always 53-character?) */
    readonly id: PeerId,
    /** IP address (either IPv4 or IPv6) of the bootnode */
    readonly ip: string,
    /** Port number on which the bootnode is listening for new connections */
    readonly port: number,
  ) {}

  get host() {
    return this.ip;
  }

  toString() {
    return `${this.id}@${this.ip}:${this.port}`;
  }
}

type PeerInfo = {
  peerId: PeerId;
  address: PeerAddress;

  /** If `Peer` is set, it means it's connected. */
  peerRef: Peer | null;
  lastConnected: number;
  maxRetries: number;
  currentRetry: number;

  backgroundTask: AbortController;

  aux: Map<AuxData<unknown>["id"], unknown>;
};

export type AuxData<T> = {
  id: symbol;
  unused?: T;
};

/** Number of attempts to re-connect to non-bootnode peers. */
const MAX_RETRIES = 5;
/** Minimal reconnection time in seconds. */
const MIN_RECONNECT_TIMEOUT_S = 3;
/** Maximal reconnection time in seconds. */
const MAX_RECONNECT_TIMEOUT_S = 3_600;

/** Manage connections to peers. */
export class Connections {
  private readonly peerInfo: Map<PeerId, PeerInfo> = new Map();

  constructor(private readonly network: Network<Peer>) {
    network.onPeerConnect((peer) => {
      this.updatePeer(peer);
      return OK;
    });
    network.onPeerDisconnect((peer) => {
      this.scheduleReconnect(peer.id);
      return OK;
    });
  }

  /** Attach some external typed data to given peer. */
  setAuxData<T>(peer: PeerId, id: AuxData<T>, data: T) {
    this.peerInfo.get(peer)?.aux.set(id.id, data);
  }

  /** Read some externally-attached data about the peer. */
  getAuxData<T>(peer: PeerId, id: AuxData<T>): T | undefined {
    return this.peerInfo.get(peer)?.aux.get(id.id) as T | undefined;
  }

  /** Read, act and update the aux data of some peer. */
  withAuxData<T>(peer: PeerId, id: AuxData<T>, onAux: (aux: T | undefined) => T) {
    const auxData = this.getAuxData(peer, id);
    const newAuxData = onAux(auxData);
    this.setAuxData(peer, id, newAuxData);
  }

  /** Return peers that are currently connected. */
  *getConnectedPeers() {
    for (const peer of this.peerInfo.values()) {
      if (peer.peerRef !== null) {
        yield peer;
      }
    }
  }

  /** Register metadata about newly connected peer. */
  private updatePeer(peer: Peer) {
    // let's check if we know something about that peer already.
    const meta = this.peerInfo.get(peer.id);
    if (meta === undefined) {
      this.peerInfo.set(peer.id, {
        peerId: peer.id,
        address: peer.address,
        peerRef: peer,
        lastConnected: Date.now(),
        maxRetries: MAX_RETRIES,
        currentRetry: 0,
        backgroundTask: new AbortController(),
        aux: new Map(),
      });
      return;
    }

    // set the peer as connected just now
    meta.peerRef = peer;
    meta.lastConnected = Date.now();
    // update it's address?
    meta.address = peer.address;
  }

  /** Attempt to scheduled a reconnect for a peer that just got disconnected. */
  private async scheduleReconnect(id: PeerId) {
    const meta = this.peerInfo.get(id);
    // just ignore peers we don't know about.
    if (meta === undefined) {
      return;
    }
    // assume the peer is disconnected.
    meta.peerRef = null;
    meta.backgroundTask = new AbortController();
    // abort signal
    const signal = meta.backgroundTask.signal;

    // now keep trying to connect
    for (;;) {
      // increase the reconnection counter
      meta.currentRetry += 1;
      if (meta.currentRetry >= meta.maxRetries) {
        // reached max retries for a peer, remove it from tracking.
        this.peerInfo.delete(id);
        return;
      }
      // else attempt to connect to a node a bit later.
      const timeoutSeconds = Math.min(
        MIN_RECONNECT_TIMEOUT_S * meta.currentRetry * meta.currentRetry,
        MAX_RECONNECT_TIMEOUT_S,
      );
      try {
        await setTimeout(timeoutSeconds * 1000, undefined, { signal });
      } catch {
        // ignoring errors here, since that's expected. We just wanted to
        // abort the task.
        return;
      }

      // seems we are already connected, bailing
      if (meta.peerRef !== null) {
        return;
      }

      try {
        await this.network.dial(meta.address, { signal, verifyName: meta.peerId });
        return;
      } catch {
        if (signal.aborted) {
          return;
        }
        // failing to connect, will retry.
      }
    }
  }

  /**
   * Add a list of peers that we should keep a consistent connection.
   *
   * That means we are going to be dialing them indefinitely (with
   * an exponential back-off though if they are unavailable).
   */
  addPersistentRetry(bootnodes: Bootnode[]) {
    for (const node of bootnodes) {
      this.peerInfo.set(node.id, {
        peerId: node.id,
        address: { host: node.host, port: node.port },
        maxRetries: 2 ** 32,
        currentRetry: 0,
        peerRef: null,
        lastConnected: 0,
        backgroundTask: new AbortController(),
        aux: new Map(),
      });
      this.scheduleReconnect(node.id);
    }
  }
}
