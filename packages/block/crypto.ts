import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

// TODO [ToDr] Docs & GP references

export const ED25519_KEY_BYTES = 32;
export type Ed25519Key = Opaque<Bytes<typeof ED25519_KEY_BYTES>, "Ed25519Key">;

export const ED25519_SIGNATURE_BYTES = 64;
export type Ed25519Signature = Opaque<Bytes<typeof ED25519_SIGNATURE_BYTES>, "Ed25519Signature">;

export const BANDERSNATCH_KEY_BYTES = 32;
export type BandersnatchKey = Opaque<Bytes<typeof BANDERSNATCH_KEY_BYTES>, "BandersnatchKey">;

export const BANDERSNATCH_RING_SIGNATURE_BYTES = 784;
export type BandersnatchRingSignature = Opaque<
  Bytes<typeof BANDERSNATCH_RING_SIGNATURE_BYTES>,
  "BandersnatchRingSignature"
>;

export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export type BandersnatchVrfSignature = Opaque<
  Bytes<typeof BANDERSNATCH_VRF_SIGNATURE_BYTES>,
  "BandersnatchVrfSignature"
>;
