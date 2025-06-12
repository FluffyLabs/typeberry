import { derive_public_key } from "@fluffylabs/bandersnatch";
import { Bytes } from "@typeberry/bytes";
import { type Opaque, check } from "@typeberry/utils";

/** Bandersnatch public key size. */
export const BANDERSNATCH_KEY_BYTES = 32;
export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;

/** BLS public key size. */
export const BLS_KEY_BYTES = 144;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;

/**
 * Potentially valid Bandersnatch public key.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/082200082200?v=0.6.7
 */
export type BandersnatchKey = Opaque<Bytes<BANDERSNATCH_KEY_BYTES>, "BandersnatchKey">;

/**
 * A public key for BLS signature scheme
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/081c00081c00?v=0.6.7
 */
export type BlsKey = Opaque<Bytes<BLS_KEY_BYTES>, "BlsKey">;

/** Derive a Bandersnatch public key from a seed. */
export function publicKey(seed: Uint8Array): BandersnatchKey {
  const key = derive_public_key(seed);

  check(key[0] === 0, "Invalid Bandersnatch public key derived from seed");

  return Bytes.fromBlob(key.subarray(1), BANDERSNATCH_KEY_BYTES).asOpaque();
}
