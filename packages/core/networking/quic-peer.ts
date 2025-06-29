import EventEmitter from "node:events";

import { events, type QUICConnection } from "@matrixai/quic";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { PeerInfo } from "./certificate.js";
import type { Peer, PeerAddress, PeerId, StreamCallback } from "./peers.js";
import { QuicStream } from "./quic-stream.js";
import { addEventListener } from "./quic-utils.js";

export class QuicPeer implements Peer {
  public readonly connectionId: string;
  public readonly address: PeerAddress;
  public readonly id: PeerId;
  public readonly key: Ed25519Key;
  private readonly logger: Logger;
  private readonly streamEvents = new EventEmitter();

  constructor(
    public readonly conn: QUICConnection,
    peerInfo: PeerInfo,
  ) {
    this.logger = Logger.new(import.meta.filename, `net:peer:${peerInfo.id}`);
    this.logger.log(`👥 peer connected ${conn.remoteHost}:${conn.remotePort}`);

    this.connectionId = conn.connectionIdShared.toString();
    this.address = {
      host: conn.remoteHost,
      port: conn.remotePort,
    };
    this.id = peerInfo.id;
    this.key = peerInfo.key;

    addEventListener(conn, events.EventQUICConnectionStream, (ev) => {
      const stream = ev.detail;
      this.logger.log(`[${stream.streamId}]🚰 new stream`);
      this.streamEvents.emit("stream", stream);
    });

    addEventListener(conn, events.EventQUICConnectionError, (err) => {
      this.logger.error(`❌ connection failed: ${err.detail}`);
    });
  }

  addOnIncomingStream(streamCallback: StreamCallback<QuicStream>): void {
    this.streamEvents.on("stream", streamCallback);
  }

  openStream(): QuicStream {
    const stream = this.conn.newStream("bidi");
    this.logger.log(`[${stream.streamId}]🚰 opening stream`);
    return new QuicStream(stream);
  }

  async disconnect() {
    this.logger.log(`👋 disconnecting`);
    await this.conn.stop({ isApp: true });
  }
}
