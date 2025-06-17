import EventEmitter from "node:events";

import { events, type QUICConnection, type QUICStream } from "@matrixai/quic";
import type { Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import type { PeerInfo } from "./certificate.js";
import type { Peer, PeerAddress, StreamCallback } from "./peers.js";
import { addEventListener } from "./quic-utils.js";

export class QuicPeer implements Peer {
  public readonly connectionId: string;
  public readonly address: PeerAddress;
  public readonly id: string;
  public readonly key: Ed25519Key;
  private readonly logger: Logger;
  private readonly streamEvents = new EventEmitter();

  constructor(
    public readonly conn: QUICConnection,
    peerInfo: PeerInfo,
  ) {
    this.logger = Logger.new(import.meta.filename, `net:peer:${conn.connectionIdShared.toString()}`);
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
      this.logger.log("New stream");
      this.streamEvents.emit("stream", stream);
    });

    addEventListener(conn, events.EventQUICConnectionError, (err) => {
      this.logger.error(`❌ connection failed: ${err.detail}`);
    });
  }

  addOnStreamOpen(streamCallback: StreamCallback<QUICStream>): void {
    this.streamEvents.on("stream", streamCallback);
  }

  openStream(): QUICStream {
    const stream = this.conn.newStream("bidi");
    this.streamEvents.emit("stream", stream);
    return stream;
  }

  async disconnect() {
    await this.conn.stop({ isApp: true });
  }
}
