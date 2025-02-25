import crypto, { createPublicKey } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { verify_ed25519, verify_ed25519_batch } from "ed25519-wasm/pkg";

/**
 * Ed25519 signatures verification.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/081300081b00
 */

/** Signature verification input. */
export type Input<T extends BytesBlob> = {
  /** Signature. */
  signature: Ed25519Signature;
  /** Public key. */
  key: Ed25519Key;
  /** Message to verify. */
  message: T;
};

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 *
 * @deprecated It is slow. Use verifyWasm instead
 */
export function verify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  return Promise.resolve(
    input.map(({ signature, message, key }) => {
      const isValid = ed25519.verify(signature.raw, message.raw, key.raw);
      return isValid;
    }),
  );
}
const SPKI_PREFIX = new Uint8Array([
  0x30,
  0x2a, // SEQUENCE (42 bytes)
  0x30,
  0x05, // SEQUENCE (5 bytes)
  0x06,
  0x03, // OBJECT IDENTIFIER (3 bytes)
  0x2b,
  0x65,
  0x70, // Ed25519 OID: 1.3.101.112
  0x03,
  0x21, // BIT STRING (33 bytes: 1 padding + 32-byte key)
  0x00, // Zero padding before key
]);

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 *
 * @deprecated It is slow. Use verifyWasm instead
 */
export function nativeVerify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  return Promise.resolve(
    input.map(({ signature, message, key }) => {
      return crypto.verify(
        null,
        message.raw,
        createPublicKey({
          key: Buffer.concat([SPKI_PREFIX, key.raw]),
          format: "der",
          type: "spki",
        }),
        Buffer.from(signature.raw),
      );
    }),
  );
}

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 */
export async function verifyWasm<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  if (input.length === 0) {
    return Promise.resolve([]);
  }

  const [first, ...rest] = input.map(({ key, signature, message }) => {
    const messageLength = message.raw.length;
    return BytesBlob.blobFromParts(key.raw, signature.raw, Uint8Array.from([messageLength]), message.raw).raw;
  });

  const data = BytesBlob.blobFromParts(first, ...rest).raw;

  const result = Array.from(verify_ed25519(data)).map((x) => x === 1);
  return Promise.resolve(result);
}

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 *
 * This function is faster than `verifyWasm` but it is not safe.
 * See "Batch verification" at the bottom here: https://crates.io/crates/ed25519-dalek
 */
export function verifyWasmBatch<T extends BytesBlob>(input: Input<T>[]): boolean {
  if (input.length === 0) {
    return true;
  }

  const [first, ...rest] = input.map(({ key, signature, message }) => {
    const messageLength = message.raw.length;
    return BytesBlob.blobFromParts(key.raw, signature.raw, Uint8Array.from([messageLength]), message.raw).raw;
  });

  const data = BytesBlob.blobFromParts(first, ...rest).raw;

  return verify_ed25519_batch(data);
}
