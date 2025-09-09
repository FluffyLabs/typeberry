import { bandersnatch } from "@typeberry/native";
import { Bytes } from "@typeberry/bytes";
import { type Opaque, check } from "@typeberry/utils";

/** Bandersnatch public key size. */
export const BANDERSNATCH_KEY_BYTES = 32;
export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;

/** Bandersnatch VRF signature size */
export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;

/** Bandersnatch ring commitment size */
export const BANDERSNATCH_RING_ROOT_BYTES = 144;
export type BANDERSNATCH_RING_ROOT_BYTES = typeof BANDERSNATCH_RING_ROOT_BYTES;

/** Bandersnatch proof size */
export const BANDERSNATCH_PROOF_BYTES = 784;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;

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
 * Bandersnatch ring commitment
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0da8000dc200?v=0.6.7
 */
export type BandersnatchRingRoot = Opaque<Bytes<BANDERSNATCH_RING_ROOT_BYTES>, "BandersnatchRingRoot">;

/**
 * Potentially valid Bandersnatch signature.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/082300082300?v=0.6.7
 */
export type BandersnatchVrfSignature = Opaque<Bytes<BANDERSNATCH_VRF_SIGNATURE_BYTES>, "BandersnatchVrfSignature">;

/**
 * Potentially valid Bandersnatch RingVRF proof of knowledge.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/082d00083a00?v=0.6.7
 */
export type BandersnatchProof = Opaque<Bytes<BANDERSNATCH_PROOF_BYTES>, "BandersnatchRingSignature">;

/**
 * A public key for BLS signature scheme
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/081c00081c00?v=0.6.7
 */
export type BlsKey = Opaque<Bytes<BLS_KEY_BYTES>, "BlsKey">;

/** Derive a Bandersnatch public key from a seed. */
export function publicKey(seed: Uint8Array): BandersnatchKey {
  const key = bandersnatch.derive_public_key(seed);

  check(key[0] === 0, "Invalid Bandersnatch public key derived from seed");

  return Bytes.fromBlob(key.subarray(1), BANDERSNATCH_KEY_BYTES).asOpaque();
}
