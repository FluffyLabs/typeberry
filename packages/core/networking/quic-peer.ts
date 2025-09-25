import EventEmitter from "node:events";

import { events, type QUICConnection } from "@matrixai/quic";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { PeerInfo } from "./certificate.js";
import type { Peer, PeerAddress, PeerId, StreamCallback } from "./peers.js";
import { QuicStream } from "./quic-stream.js";
import { addEventListener } from "./quic-utils.js";

const logger = Logger.new(import.meta.filename, "peers");

export class QuicPeer implements Peer {
  public readonly connectionId: string;
  public readonly address: PeerAddress;
  public readonly id: PeerId;
  public readonly key: Ed25519Key;
  private readonly streamEvents = new EventEmitter();

  constructor(
    public readonly conn: QUICConnection,
    peerInfo: PeerInfo,
  ) {
    logger.log`👥 [${peerInfo.id}] peer connected ${conn.remoteHost}:${conn.remotePort}`;

    this.connectionId = conn.connectionIdShared.toString();
    this.address = {
      host: conn.remoteHost,
      port: conn.remotePort,
    };
    this.id = peerInfo.id;
    this.key = peerInfo.key;

    addEventListener(conn, events.EventQUICConnectionStream, (ev) => {
      const stream = ev.detail;
      logger.log`🚰  [${this.id}] new stream: [${stream.streamId}]`;
      this.streamEvents.emit("stream", new QuicStream(stream));
    });

    addEventListener(conn, events.EventQUICConnectionError, (err) => {
      logger.error`❌ [${this.id}] connection failed: ${err.detail}`;
    });
  }

  addOnIncomingStream(streamCallback: StreamCallback<QuicStream>): void {
    this.streamEvents.on("stream", streamCallback);
  }

  openStream(): QuicStream {
    const stream = this.conn.newStream("bidi");
    logger.log`🚰 [${this.id}] opening stream: [${stream.streamId}]`;
    return new QuicStream(stream);
  }

  async disconnect() {
    logger.log`👋 [${this.id}] disconnecting`;
    await this.conn.stop({ isApp: true });
  }
}
