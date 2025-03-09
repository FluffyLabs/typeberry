import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export const ED25519_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;
export const BANDERSNATCH_KEY_BYTES = 32;
export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export const BANDERSNATCH_RING_ROOT_BYTES = 144;
export const BANDERSNATCH_PROOF_BYTES = 784;
export const BLS_KEY_BYTES = 144;

export type ED25519_KEY_BYTES = typeof ED25519_KEY_BYTES;
export type ED25519_SIGNATURE_BYTES = typeof ED25519_SIGNATURE_BYTES;
export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;
export type BANDERSNATCH_RING_ROOT_BYTES = typeof BANDERSNATCH_RING_ROOT_BYTES;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;

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
