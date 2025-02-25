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
