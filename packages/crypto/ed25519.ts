import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, type Ed25519Key, type Ed25519Signature } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { check } from "@typeberry/utils";
import { verify_ed25519, verify_ed25519_batch } from "ed25519-wasm/pkg";

/**
 * Ed25519 signatures verification.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/081300081b00
 */

/** Signature verification input. */
export type Input<T extends BytesBlob = BytesBlob> = {
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
export async function verify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  if (input.length === 0) {
    return Promise.resolve([]);
  }
  const dataLength = input.reduce(
    (acc, { message, key, signature }) => acc + key.length + signature.length + message.length + 1,
    0,
  );
  const data = new Uint8Array(dataLength);

  let offset = 0;

  for (const { key, message, signature } of input) {
    data.set(key.raw, offset);
    offset += ED25519_KEY_BYTES;
    data.set(signature.raw, offset);
    offset += ED25519_SIGNATURE_BYTES;
    const messageLength = message.length;
    check(messageLength < 256, `Message needs to be shorter than 256 bytes. Got: ${messageLength}`);
    data[offset] = messageLength;
    offset += 1;
    data.set(message.raw, offset);
    offset += messageLength;
  }

  const result = Array.from(verify_ed25519(data)).map((x) => x === 1);
  return Promise.resolve(result);
}

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 *
 * This function is faster than `verify` but it is not safe.
 * See "Batch verification" at the bottom here: https://crates.io/crates/ed25519-dalek
 */
export function verifyBatch<T extends BytesBlob>(input: Input<T>[]): boolean {
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
