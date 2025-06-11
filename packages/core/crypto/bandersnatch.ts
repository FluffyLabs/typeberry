import { derive_public_key } from "@fluffylabs/bandersnatch";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";

export const BANDERSNATCH_KEY_BYTES = 32;
export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export const BANDERSNATCH_RING_ROOT_BYTES = 144;
export const BANDERSNATCH_PROOF_BYTES = 784;
export const BLS_KEY_BYTES = 144;

export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;
export type BANDERSNATCH_RING_ROOT_BYTES = typeof BANDERSNATCH_RING_ROOT_BYTES;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;

/**
 * Potentially valid Bandersnatch public key.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/082200082200
 */
export type BandersnatchKey = Opaque<Bytes<BANDERSNATCH_KEY_BYTES>, "BandersnatchKey">;

/**
 * Bandersnatch ring commitment
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/0da8000dc200
 */
export type BandersnatchRingRoot = Opaque<Bytes<BANDERSNATCH_RING_ROOT_BYTES>, "BandersnatchRingRoot">;

/**
 * Potentially valid Bandersnatch signature.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/082200082200
 */
export type BandersnatchVrfSignature = Opaque<Bytes<BANDERSNATCH_VRF_SIGNATURE_BYTES>, "BandersnatchVrfSignature">;

/**
 * Potentially valid Bandersnatch RingVRF proof of knowledge.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/082d00083a00
 */
export type BandersnatchProof = Opaque<Bytes<BANDERSNATCH_PROOF_BYTES>, "BandersnatchRingSignature">;

/**
 * A public key for BLS signature scheme
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/081c00081c00
 */
export type BlsKey = Opaque<Bytes<BLS_KEY_BYTES>, "BlsKey">;

/** Derive a Bandersnatch public key from a seed. */
export function publicKey(seed: Uint8Array): BandersnatchKey {
  const key = derive_public_key(seed);

  // Can happen if there is not enough memory to derive the key
  const success = key[0] === 0;
  if (!success) {
    throw new Error("Invalid public key: Out of memory error");
  }

  return Bytes.fromBlob(key.subarray(1), HASH_SIZE).asOpaque();
}
