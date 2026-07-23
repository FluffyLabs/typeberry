/**
 * Browser-safe cryptographic sizes and opaque data types.
 *
 * This module intentionally has no runtime imports. The annotations on the
 * mirrored constants make TypeScript fail if their canonical values in the
 * implementation modules change.
 */

type CanonicalEd25519PrivateKeyBytes = typeof import("./ed25519.js").ED25519_PRIV_KEY_BYTES;
type CanonicalEd25519KeyBytes = typeof import("./ed25519.js").ED25519_KEY_BYTES;
type CanonicalEd25519SignatureBytes = typeof import("./ed25519.js").ED25519_SIGNATURE_BYTES;
type CanonicalBandersnatchKeyBytes = typeof import("./bandersnatch.js").BANDERSNATCH_KEY_BYTES;
type CanonicalBandersnatchVrfSignatureBytes = typeof import("./bandersnatch.js").BANDERSNATCH_VRF_SIGNATURE_BYTES;
type CanonicalBandersnatchRingRootBytes = typeof import("./bandersnatch.js").BANDERSNATCH_RING_ROOT_BYTES;
type CanonicalBandersnatchProofBytes = typeof import("./bandersnatch.js").BANDERSNATCH_PROOF_BYTES;
type CanonicalBlsKeyBytes = typeof import("./bandersnatch.js").BLS_KEY_BYTES;

export const ED25519_PRIV_KEY_BYTES: CanonicalEd25519PrivateKeyBytes = 32;
export type ED25519_PRIV_KEY_BYTES = typeof ED25519_PRIV_KEY_BYTES;

export const ED25519_KEY_BYTES: CanonicalEd25519KeyBytes = 32;
export type ED25519_KEY_BYTES = typeof ED25519_KEY_BYTES;

export const ED25519_SIGNATURE_BYTES: CanonicalEd25519SignatureBytes = 64;
export type ED25519_SIGNATURE_BYTES = typeof ED25519_SIGNATURE_BYTES;

export const BANDERSNATCH_KEY_BYTES: CanonicalBandersnatchKeyBytes = 32;
export type BANDERSNATCH_KEY_BYTES = typeof BANDERSNATCH_KEY_BYTES;

export const BANDERSNATCH_VRF_SIGNATURE_BYTES: CanonicalBandersnatchVrfSignatureBytes = 96;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;

export const BANDERSNATCH_RING_ROOT_BYTES: CanonicalBandersnatchRingRootBytes = 144;
export type BANDERSNATCH_RING_ROOT_BYTES = typeof BANDERSNATCH_RING_ROOT_BYTES;

export const BANDERSNATCH_PROOF_BYTES: CanonicalBandersnatchProofBytes = 784;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;

export const BLS_KEY_BYTES: CanonicalBlsKeyBytes = 144;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;

export type {
  BandersnatchKey,
  BandersnatchProof,
  BandersnatchRingRoot,
  BandersnatchVrfSignature,
  BlsKey,
} from "./bandersnatch.js";
export type { Ed25519Key, Ed25519Signature } from "./ed25519.js";
