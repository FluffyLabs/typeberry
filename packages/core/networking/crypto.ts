import { webcrypto } from "node:crypto";
import type { QUICClientCrypto, QUICServerCrypto } from "@matrixai/quic";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, type Ed25519Pair, ed25519 } from "@typeberry/crypto";

/**
 * Crypto utilitiy functions required by the QUIC server.
 *
 * Implements `ed25519` signing and verification and presents the server key.
 */
export function getQuicServerCrypto(key: Ed25519Pair): QUICServerCrypto {
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

/**
 * Crypto utilities functions required by the QUIC client.
 *
 * We just need to be able to get crypto-secure random bytes.
 */
export function getQuicClientCrypto(): QUICClientCrypto {
  return {
    ops: {
      async randomBytes(data: ArrayBuffer): Promise<void> {
        webcrypto.getRandomValues(new Uint8Array(data));
      },
    },
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
