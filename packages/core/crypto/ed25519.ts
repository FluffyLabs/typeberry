import fs from "node:fs";
import * as ed from "@noble/ed25519";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Opaque, check, isBrowser } from "@typeberry/utils";
import { default as ed25519init, verify_ed25519, verify_ed25519_batch } from "ed25519-wasm/pkg/ed25519_wasm.js";

const ed25119ready = ed25519init(
  isBrowser()
    ? undefined
    : {
        module_or_path: fs.readFileSync(
          new URL(import.meta.resolve("ed25519-wasm/pkg/ed25519_wasm_bg.wasm"), import.meta.url),
        ),
      },
);

/** ED25519 private key size. */
export const ED25519_PRIV_KEY_BYTES = 32;
type ED25519_PRIV_KEY_BYTES = typeof ED25519_PRIV_KEY_BYTES;

/** ED25519 public key size. */
export const ED25519_KEY_BYTES = 32;
export type ED25519_KEY_BYTES = typeof ED25519_KEY_BYTES;

/** ED25519 signature size. */
export const ED25519_SIGNATURE_BYTES = 64;
export type ED25519_SIGNATURE_BYTES = typeof ED25519_SIGNATURE_BYTES;

/**
 * Potentially valid Ed25519 public key.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/081300081a00
 */
export type Ed25519Key = Opaque<Bytes<ED25519_KEY_BYTES>, "Ed25519Key">;

/**
 * Potentially valid Ed25519 signature.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/081300081a00
 */
export type Ed25519Signature = Opaque<Bytes<ED25519_SIGNATURE_BYTES>, "Ed25519Signature">;

/**
 * Ed25519 pub+priv key pair.
 *
 * Can be passed to `sign` method to produce signatures.
 */
export class Ed25519Pair {
  constructor(
    /** Public key */
    public readonly pubKey: Ed25519Key,
    /** Private key. NOTE: Avoid using directly. */
    public readonly _privKey: Bytes<ED25519_PRIV_KEY_BYTES>,
  ) {}
}

/** Create a private key from given raw bytes. */
export async function privateKey(privKey: Bytes<ED25519_PRIV_KEY_BYTES>): Promise<Ed25519Pair> {
  const pubKey = await ed.getPublicKeyAsync(privKey.raw);
  return new Ed25519Pair(Bytes.fromBlob(pubKey, ED25519_KEY_BYTES).asOpaque(), privKey.asOpaque());
}

/** Sign given piece of data using provided key pair. */
export async function sign<T extends BytesBlob>(key: Ed25519Pair, message: T): Promise<Ed25519Signature> {
  const signature = await ed.signAsync(message.raw, key._privKey.raw);
  return Bytes.fromBlob(signature, ED25519_SIGNATURE_BYTES).asOpaque();
}

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
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/081300081b00
 */
export async function verify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  await ed25119ready;

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
export async function verifyBatch<T extends BytesBlob>(input: Input<T>[]): Promise<boolean> {
  if (input.length === 0) {
    return true;
  }

  const [first, ...rest] = input.map(({ key, signature, message }) => {
    const messageLength = message.raw.length;
    return BytesBlob.blobFromParts(key.raw, signature.raw, Uint8Array.from([messageLength]), message.raw).raw;
  });

  const data = BytesBlob.blobFromParts(first, ...rest).raw;

  return Promise.resolve(verify_ed25519_batch(data));
}
