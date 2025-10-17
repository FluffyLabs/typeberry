import QuicLogger, { formatting, LogLevel, StreamHandler } from "@matrixai/logger";
import { events, QUICClient, type QUICConnection, QUICServer, QUICSocket } from "@matrixai/quic";
import { BytesBlob } from "@typeberry/bytes";
import type { Ed25519Pair } from "@typeberry/crypto/ed25519.js";
import { Level, Logger } from "@typeberry/logger";
import {
  altNameRaw,
  certToPEM,
  ed25519AsJsonWebKeyPair,
  generateCertificate,
  type PeerInfo,
  privateKeyToPEM,
} from "./certificate.js";
import { getQuicClientCrypto, getQuicServerCrypto } from "./crypto.js";
import type { DialOptions } from "./network.js";
import { peerVerification } from "./peer-verification.js";
import { type PeerAddress, PeersManagement } from "./peers.js";
import { QuicNetwork } from "./quic-network.js";
import { QuicPeer } from "./quic-peer.js";
import { addEventListener } from "./quic-utils.js";

const logger = Logger.new(import.meta.filename, "net");

/** Networking server part options. */
export type Options = {
  /** Peer's ed25519key. */
  key: Ed25519Pair;
  /** Host interface to bound to. */
  host: string;
  /** Port to listen on. Use `0` for random. */
  port: number;
  /** Supported ALPNs (protocols) both for the inbound and outbound connections. */
  protocols: string[];
};

enum CloseReason {
  PeerIdMismatch = 0,
  DuplicateConnection = 1,
  ConnectionFromOurself = 2,
}

export class Quic {
  /** Setup QUIC socket and start listening for connections. */
  static async setup({ host, port, protocols, key }: Options): Promise<QuicNetwork> {
    const quicLoggerLvl = logger.getLevel() > Level.TRACE ? LogLevel.WARN : LogLevel.DEBUG;
    const quicLogger = new QuicLogger("quic", quicLoggerLvl, [
      new StreamHandler(formatting.format`${formatting.level}:${formatting.keys}:${formatting.msg}`),
    ]);

    // Load keypair
    const keyPair = ed25519AsJsonWebKeyPair(key);
    const privKeyPEM = await privateKeyToPEM(keyPair);
    const cert = await generateCertificate({
      certId: BytesBlob.blobFromString("QUIC Networking"),
      subjectKeyPair: keyPair,
      issuerKeyPair: keyPair,
    });

    const lastConnectedPeer = peerVerification();

    // QUICConfig
    const config = {
      keepAliveIntervalTime: 3000,
      maxIdleTimeout: 6000,
      applicationProtos: protocols,
      cert: certToPEM(cert),
      key: privKeyPEM,
      verifyPeer: true,
      verifyCallback: lastConnectedPeer.verifyCallback,
    };

    logger.info`🆔 Peer id: ** ${altNameRaw(key.pubKey)}@${host}:${port} ** (pubkey: ${key.pubKey})`;
    // Shared injected UDP socket
    const socket = new QUICSocket({
      logger: quicLogger.getChild("socket"),
    });

    // Start server on the socket.
    const server = new QUICServer({
      socket,
      config,
      crypto: getQuicServerCrypto(key),
      logger: quicLogger.getChild("server"),
    });

    // peer management
    const peers = new PeersManagement<QuicPeer>();

    // basic error handling
    addEventListener(server, events.EventQUICServerError, (error) => logger.error`🛜  Server error: ${error}`);
    addEventListener(server, events.EventQUICServerClose, (ev) => logger.error`🛜  Server stopped: ${ev}`);

    // handling incoming session
    addEventListener(server, events.EventQUICServerConnection, async (ev) => {
      const conn = ev.detail;
      if (lastConnectedPeer.info === null) {
        await conn.stop();
        return;
      }

      if (lastConnectedPeer.info.key.isEqualTo(key.pubKey)) {
        logger.log`🛜 Rejecting connection from ourself from ${conn.remoteHost}:${conn.remotePort}`;
        await conn.stop({ isApp: true, errorCode: CloseReason.ConnectionFromOurself });
        return;
      }

      if (peers.isConnected(lastConnectedPeer.info.id)) {
        logger.log`🛜 Rejecting duplicate connection with peer ${lastConnectedPeer.info.id} from ${conn.remoteHost}:${conn.remotePort}`;
        await conn.stop({ isApp: true, errorCode: CloseReason.DuplicateConnection });
        return;
      }

      logger.log`🛜 Server handshake with ${conn.remoteHost}:${conn.remotePort}`;
      newPeer(conn, lastConnectedPeer.info);
      lastConnectedPeer.info = null;
      await conn.start();
    });

    // connecting to a peer
    async function dial(peer: PeerAddress, options: DialOptions): Promise<QuicPeer> {
      return doDial();

      async function doDial() {
        const peerDetails = peerVerification();
        const clientLater = QUICClient.createQUICClient(
          {
            socket: socket,
            host: peer.host,
            port: peer.port,
            crypto: getQuicClientCrypto(),
            config: {
              ...config,
              verifyCallback: peerDetails.verifyCallback,
            },
            logger: quicLogger.getChild("client"),
          },
          {
            signal: options.signal,
          },
        );
        const client = await clientLater;

        if (peerDetails.info === null) {
          await client.destroy({ isApp: true, errorCode: CloseReason.PeerIdMismatch });
          throw new Error("Client connected, but there is no peer details!");
        }

        if (options.verifyName !== undefined && options.verifyName !== peerDetails.info.id) {
          await client.destroy({ isApp: true, errorCode: CloseReason.PeerIdMismatch });
          throw new Error(
            `Client connected, but the id didn't match. Expected: ${options.verifyName}, got: ${peerDetails.info.id}`,
          );
        }

        addEventListener(client, events.EventQUICClientClose, () => {
          logger.log`⚰️ Client connection closed.`;
        });

        addEventListener(client, events.EventQUICClientError, (error) => {
          logger.error`🔴 Client error: ${error.detail}`;
        });

        logger.log`🤝 Client handshake with: ${peer.host}:${peer.port}`;
        return newPeer(client.connection, peerDetails.info);
      }
    }

    function newPeer(conn: QUICConnection, peerInfo: PeerInfo) {
      const peer = new QuicPeer(conn, peerInfo);
      addEventListener(peer.conn, events.EventQUICConnectionClose, () => peers.peerDisconnected(peer));
      peers.peerConnected(peer);
      return peer;
    }

    return new QuicNetwork(socket, server, dial, peers, { host, port });
  }
}
