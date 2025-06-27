import type { QUICServer, QUICSocket } from "@matrixai/quic";
import { Logger } from "@typeberry/logger";
import type { Network } from "./network.js";
import type { PeerAddress, PeerCallback, Peers } from "./peers.js";
import type { QuicPeer } from "./quic-peer.js";

const logger = Logger.new(import.meta.filename, "net");

export class QuicNetwork implements Network<QuicPeer> {
  private started = false;

  constructor(
    private readonly socket: QUICSocket,
    private readonly server: QUICServer,
    private readonly _dial: (peer: PeerAddress) => Promise<QuicPeer>,
    private readonly peers: Peers<QuicPeer>,
    private readonly listen: { host: string; port: number },
  ) {}

  async start() {
    if (this.started) {
      throw new Error("Network already started!");
    }

    this.started = true;
    await this.socket.start({ host: this.listen.host, port: this.listen.port });
    logger.info(`🛜  QUIC socket on ${this.socket.host}:${this.socket.port}`);
    await this.server.start();
    logger.log("🛜  QUIC server listening");
  }

  async stop() {
    if (!this.started) {
      throw new Error("Network not started yet!");
    }

    logger.info("Stopping the networking.");
    await this.server.stop();
    await this.socket.stop();
    this.started = false;
    logger.info("Networking stopped.");
  }

  onPeerConnect(onPeer: PeerCallback<QuicPeer>) {
    return this.peers.addOnPeerConnected(onPeer);
  }

  onPeerDisconnect(onPeer: PeerCallback<QuicPeer>) {
    return this.peers.addOnPeerDisconnected(onPeer);
  }

  async dial(peer: PeerAddress): Promise<QuicPeer> {
    return this._dial(peer);
  }
}
