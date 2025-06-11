import { derive_public_key } from "@fluffylabs/bandersnatch";
import { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export const BANDERSNATCH_KEY_BYTES = 32;
export const BLS_KEY_BYTES = 144;

export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;

/**
 * Potentially valid Bandersnatch public key.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/082200082200
 */
export type BandersnatchKey = Opaque<Bytes<BANDERSNATCH_KEY_BYTES>, "BandersnatchKey">;

/**
 * A public key for BLS signature scheme
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/081c00081c00
 */
export type BlsKey = Opaque<Bytes<BLS_KEY_BYTES>, "BlsKey">;

/** Derive a Bandersnatch public key from a seed. */
export function publicKey(seed: Uint8Array): BandersnatchKey {
  const key = derive_public_key(seed);

  // NOTE: We assume that the key is valid, as the derivation function should only
  // fail in case of OutOfMemory Error.
  return Bytes.fromBlob(key.subarray(1), BANDERSNATCH_KEY_BYTES).asOpaque();
}
