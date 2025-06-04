import { webcrypto } from "node:crypto";
import EventEmitter from "node:events";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, ed25519 } from "@typeberry/crypto";
import type { Ed25519Pair } from "@typeberry/crypto/ed25519";
import { Logger } from "@typeberry/logger";
import {
  type PeerInfo,
  VerifyCertError,
  certToPEM,
  ed25519AsJsonWebKeyPair,
  generateCertificate,
  privateKeyToPEM,
  verifyCertificate,
} from "./certificate";
import type { Network } from "./network";
import { type Peer, type PeerAddress, Peers, type Stream } from "./peers";

const logger = Logger.new(__filename, "net");

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

type Connection = {
  connectionId: string;
  connectionIdShared: string;
  remoteHost: string;
  remotePort: number;
  start(): Promise<void>;
  stop(): Promise<void>;
  newStream(kind: "bidi"): Stream;
  addEventListener(name: string, callback: unknown): void;
};

type EventWithConnection = {
  detail: Connection;
};

type EventWithStream = {
  detail: Stream;
};

/** Setup QUIC socket and start listening for connections. */
export async function setup({ host, port, protocols, key }: Options): Promise<Network> {
  const { default: Logger, formatting, LogLevel, StreamHandler } = await import("@matrixai/logger");
  const quicLogger = new Logger("quic", LogLevel.DEBUG, [
    new StreamHandler(formatting.format`${formatting.level}:${formatting.keys}:${formatting.msg}`),
  ]);
  const { QUICServer, QUICSocket, QUICClient, events } = await import("@matrixai/quic");
  const { CryptoError } = await import("@matrixai/quic/native/types.js");

  function asCryptoError(error: VerifyCertError | undefined) {
    if (error === undefined) {
      return error;
    }
    switch (error) {
      case VerifyCertError.AltNameMismatch:
        return CryptoError.IllegalParameter;
      case VerifyCertError.NotEd25519:
        return CryptoError.InsufficientSecurity;
      case VerifyCertError.PublicKeyTypeMismatch:
        return CryptoError.BadCertificate;
      case VerifyCertError.NoCertificate:
        return CryptoError.CertificateRequired;
      case VerifyCertError.IncorrectSignature:
        return CryptoError.BadCertificate;
      default:
        throw new Error(`Unexpected VerifyCertError: ${error}`);
    }
  }

  function peerVerification() {
    const peer: {
      id: PeerInfo | null;
      /** Takes all certicates the peer presented and all local certifcates from Certificate Authorities (unused) */
      verifyCallback: (certs: Uint8Array[], cas: Uint8Array[]) => Promise<ReturnType<typeof asCryptoError> | undefined>;
    } = {
      id: null,
      verifyCallback: async (certs: Uint8Array[], _cas: Uint8Array[]) => {
        const verification = await verifyCertificate(certs);
        if (verification.isError) {
          return asCryptoError(verification.error);
        }
        peer.id = verification.ok;
        return undefined;
      },
    };
    return peer;
  }

  // Load keypair
  const keyPair = ed25519AsJsonWebKeyPair(key);
  const privKeyPEM = await privateKeyToPEM(keyPair);
  const cert = await generateCertificate({
    certId: BytesBlob.blobFromString("QUIC Networking"),
    subjectKeyPair: keyPair,
    issuerKeyPair: keyPair,
  });

  const lastConnectedPeer = peerVerification();
  const peers = new Peers();

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

  logger.info(`Using key: ${key.pubKey}`);
  // Shared injected UDP socket
  const socket = new QUICSocket({
    logger: quicLogger.getChild("socket"),
  });

  // Start server on the socket.
  const server = new QUICServer({
    socket,
    config,
    crypto: ed25519Crypto(key),
    logger: quicLogger.getChild("server"),
  });

  // new incoming session
  server.addEventListener(events.EventQUICServerConnection.name, async (ev: EventWithConnection) => {
    const conn = ev.detail;
    if (lastConnectedPeer.id === null) {
      await conn.stop();
      return;
    }
    logger.log(`🛜 Server handshake with ${conn.remoteHost}:${conn.remotePort}`);
    handleNewPeer(conn, lastConnectedPeer.id);
    await conn.start();
  });

  // basic error handling
  server.addEventListener(events.EventQUICServerError.name, (error: unknown) => logger.error(`Server error: ${error}`));
  server.addEventListener(events.EventQUICServerClose.name, (ev: unknown) => logger.error(`Server stopped: ${ev}`));

  function handleNewPeer(conn: Connection, peerInfo: PeerInfo): Peer {
    logger.log(`👥 peer connected ${conn.remoteHost}:${conn.remotePort}`);
    const streamEvents = new EventEmitter();
    const peerData: Peer = {
      connectionId: conn.connectionIdShared.toString(),
      address: {
        host: conn.remoteHost,
        port: conn.remotePort,
      },
      ...peerInfo,
      addOnStreamOpen(streamCallback) {
        streamEvents.on("stream", streamCallback);
      },
      openStream() {
        const stream = conn.newStream("bidi");
        streamEvents.emit("stream", stream);
        return stream;
      },
    };

    conn.addEventListener(events.EventQUICConnectionError.name, (err: { type: string }) => {
      logger.error(`❌ connection failed: ${err.type}`);
    });
    conn.addEventListener(events.EventQUICConnectionClose.name, () => peers.peerDisconnected(peerData));

    conn.addEventListener(events.EventQUICConnectionStream.name, (ev: EventWithStream) => {
      const stream = ev.detail;
      logger.log("New stream");
      streamEvents.emit("stream", stream);
    });

    peers.peerConnected(peerData);
    return peerData;
  }

  async function dial(peer: PeerAddress): Promise<Peer> {
    const peerDetails = peerVerification();
    let peerData: Peer | null = null;
    const client = await QUICClient.createQUICClient({
      socket,
      host: peer.host,
      port: peer.port,
      crypto: clientCryptoOps(),
      config: {
        ...config,
        verifyCallback: peerDetails.verifyCallback,
      },
      logger: quicLogger.getChild("client"),
    });

    client.addEventListener(events.EventQUICClientClose.name, () => {
      logger.log("Connection closed.");
      if (peerData !== null) {
        peers.peerDisconnected(peerData);
      }
    });

    return new Promise((resolve, reject) => {
      client.addEventListener(events.EventQUICClientError.name, (error: unknown) => {
        quicLogger.error(`Client error: ${error}`);
        reject(`${error}`);
      });

      logger.log(`🤝 handshake with: ${peer.host}:${peer.port}`);
      if (peerDetails.id === null) {
        return reject("no peer details!");
      }

      // TODO [ToDr] Temporary unsafe cast due to lack of ESM.
      const conn = client.connection as unknown as Connection;
      peerData = handleNewPeer(conn, peerDetails.id);
      return resolve(peerData);
    });
  }

  return {
    async start() {
      await socket.start({ host, port, reuseAddr: false });
      logger.info(`🛜  QUIC socket on ${socket.host}:${socket.port}`);
      await server.start();
      logger.log("🛜  QUIC server listening");
    },
    async stop() {
      logger.info("Stopping the networking.");
      await server.stop();
      await socket.stop();
      logger.info("Networking stopped.");
    },
    onPeerConnect(onPeer) {
      peers.addOnPeerConnected(onPeer);
    },
    onPeerDisconnect(onPeer) {
      peers.addOnPeerDisconnected(onPeer);
    },
    dial,
  };
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.buffer instanceof ArrayBuffer) {
    return data.buffer;
  }
  const buffer = new ArrayBuffer(data.length);
  const copy = new Uint8Array(buffer);
  copy.set(data, 0);
  return buffer;
}

function ed25519Crypto(key: Ed25519Pair) {
  return {
    key: toArrayBuffer(key._privKey.raw),
    ops: {
      async sign(privKey: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
        const key = await ed25519.privateKey(Bytes.fromBlob(new Uint8Array(privKey), ED25519_KEY_BYTES).asOpaque());
        const sig = await ed25519.sign(key, BytesBlob.blobFrom(new Uint8Array(data)));
        return toArrayBuffer(sig.raw);
      },
      async verify(privKey: ArrayBuffer, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
        const key = await ed25519.privateKey(Bytes.fromBlob(new Uint8Array(privKey), ED25519_KEY_BYTES).asOpaque());
        const res = await ed25519.verify([
          {
            signature: Bytes.fromBlob(new Uint8Array(signature), ED25519_SIGNATURE_BYTES).asOpaque(),
            key: key.pubKey,
            message: BytesBlob.blobFrom(new Uint8Array(data)),
          },
        ]);
        return res[0];
      },
    },
  };
}

function clientCryptoOps() {
  return {
    ops: {
      async randomBytes(data: ArrayBuffer): Promise<void> {
        webcrypto.getRandomValues(new Uint8Array(data));
      },
    },
  };
}
