export * as ed25519 from "./ed25519.js";
export type { Ed25519Key, Ed25519Signature } from "./ed25519.js";
export { Ed25519Pair, ED25519_KEY_BYTES, ED25519_PRIV_KEY_BYTES, ED25519_SIGNATURE_BYTES } from "./ed25519.js";

export * as bandersnatch from "./bandersnatch.js";
export type {
  BandersnatchKey,
  BandersnatchProof,
  BandersnatchRingRoot,
  BandersnatchVrfSignature,
  BlsKey,
} from "./bandersnatch.js";
export {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_PROOF_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  BLS_KEY_BYTES,
} from "./bandersnatch.js";
