import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export const ED25519_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;
export const BANDERSNATCH_KEY_BYTES = 32;
export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export const BANDERSNATCH_PROOF_BYTES = 784;

export type ED25519_KEY_BYTES = typeof ED25519_KEY_BYTES;
export type ED25519_SIGNATURE_BYTES = typeof ED25519_SIGNATURE_BYTES;
export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;

/**
 * Potentially valid Ed25519 public key.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/081200081b00
 */
export type Ed25519Key = Opaque<Bytes<ED25519_KEY_BYTES>, "Ed25519Key">;

/**
 * Potentially valid Ed25519 signature.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/081200081b00
 */
export type Ed25519Signature = Opaque<Bytes<ED25519_SIGNATURE_BYTES>, "Ed25519Signature">;

/**
 * Potentially valid Bandersnatch public key.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/082200082400
 */
export type BandersnatchKey = Opaque<Bytes<BANDERSNATCH_KEY_BYTES>, "BandersnatchKey">;

/**
 * Potentially valid Bandersnatch signature.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/082200082400
 */
export type BandersnatchVrfSignature = Opaque<Bytes<BANDERSNATCH_VRF_SIGNATURE_BYTES>, "BandersnatchVrfSignature">;

/**
 * Potentially valid Bandersnatch RingVRF proof of knowledge.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/082d00083a00
 */
export type BandersnatchProof = Opaque<Bytes<BANDERSNATCH_PROOF_BYTES>, "BandersnatchRingSignature">;
