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
  verifyCertificate,
} from "./certificate";
import type { Network } from "./network";
import { type Peer, type PeerAddress, Peers } from "./peers";

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
  const cert = await generateCertificate({
    certId: BytesBlob.blobFromString("QUIC Networking"),
    subjectKeyPair: keyPair,
    issuerKeyPair: keyPair,
  });

  // QUICConfig
  const lastConnectedPeer = peerVerification();
  const config = {
    keepAliveIntervalTime: 3000,
    maxIdleTimeout: 6000,
    applicationProtos: protocols,
    cert: certToPEM(cert),
    key: privateKeyToPEM(key),
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
  server.addEventListener(events.EventQUICServerConnection.name, onIncomingSession);
  server.addEventListener(events.EventQUICServerError.name, (error: unknown) => logger.error(`Server error: ${error}`));
  server.addEventListener(events.EventQUICServerClose.name, (ev: unknown) => logger.error(`Server stopped: ${ev}`));

  async function onIncomingSession(ev: any) {
    const conn = ev.detail;
    logger.log(`🛜 Server handshake with ${conn.remoteHost}:${conn.remotePort}`);
    if (lastConnectedPeer.id === null) {
      await conn.stop();
      return;
    }

    const streamEvents = new EventEmitter();
    const peerData: Peer = {
      connectionId: conn.connectionIdShared.toString(),
      address: {
        host: conn.remoteHost,
        port: conn.remotePort,
      },
      ...lastConnectedPeer.id,
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
    conn.addEventListener(events.EventQUICConnectionStream.name, (ev: any) => {
      const stream = ev.detail;
      logger.log("New stream");
      streamEvents.emit("stream", stream);
    });
    peers.peerConnected(peerData);

    await conn.start();
  }

  const peers = new Peers();

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

      const conn = client.connection;
      const streamEvents = new EventEmitter();

      conn.addEventListener(events.EventQUICConnectionStream.name, (ev: any) => {
        const stream = ev.detail;
        logger.log("New stream");
        streamEvents.emit("stream", stream);
      });

      peerData = {
        connectionId: conn.connectionId.toString(),
        ...peerDetails.id,
        address: peer,
        addOnStreamOpen(streamCallback) {
          streamEvents.on("stream", streamCallback);
        },
        openStream() {
          const stream = conn.newStream("bidi");
          streamEvents.emit("stream", stream);
          return stream;
        },
      };

      peers.peerConnected(peerData);
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
  const copy = Uint8Array.from(data);
  return copy.buffer as ArrayBuffer;
}

function ed25519Crypto(key: Ed25519Pair) {
  return {
    key: toArrayBuffer(key.privKey.raw),
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

function privateKeyToPEM(key: Ed25519Pair) {
  // TODO [ToDr] Temporary, probably should rather use `exportKey` to produce DER.

  // PKCS#8 header for Ed25519, 16 bytes:
  //   SEQUENCE, version=0, algorithm OID (1.3.101.112), OCTET STRING tag
  const pkcs8Header = Uint8Array.from([
    0x30,
    0x2e, // SEQUENCE, length=46
    0x02,
    0x01,
    0x00, //   INTEGER 0
    0x30,
    0x05, //   SEQUENCE, length=5
    0x06,
    0x03, //     OID (3 bytes)
    0x2b,
    0x65,
    0x70, //     1.3.101.112 = Ed25519
    0x04,
    0x22, //   OCTET STRING, length=34
    0x04,
    0x20, //     OCTET STRING, length=32
  ]);

  // Combine header + raw seed into one Uint8Array
  const der = new Uint8Array(pkcs8Header.length + key.privKey.length);
  der.set(pkcs8Header, 0);
  der.set(key.privKey.raw, pkcs8Header.length);

  // Base64-encode and wrap as PEM
  const b64 = Buffer.from(der).toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [];
  return ["-----BEGIN PRIVATE KEY-----", ...lines, "-----END PRIVATE KEY-----", ""].join("\n");
}
