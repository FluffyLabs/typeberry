import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Blake2b } from "@typeberry/hash";
import { type U32, u32AsLeBytes } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { type BandersnatchKey, publicKey } from "./bandersnatch.js";
import { type Ed25519Key, privateKey } from "./ed25519.js";

export const SEED_SIZE = 32;
export type SEED_SIZE = typeof SEED_SIZE;

const ED25519_SECRET_KEY = Bytes.blobFromString("jam_val_key_ed25519");
const BANDERSNATCH_SECRET_KEY = Bytes.blobFromString("jam_val_key_bandersnatch");

export type KeySeed = Opaque<Bytes<SEED_SIZE>, "PublicKeySeed">;
export type Ed25519SecretSeed = Opaque<Bytes<SEED_SIZE>, "Ed25519SecretSeed">;
export type BandersnatchSecretSeed = Opaque<Bytes<SEED_SIZE>, "BandersnatchSecretSeed">;

/**
 * JIP-5: Secret key derivation
 *
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md */

/**
 * Deriving a 32-byte seed from a 32-bit unsigned integer
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#trivial-seeds
 */
export function trivialSeed(s: U32): KeySeed {
  const s_le = u32AsLeBytes(s);
  return Bytes.fromBlob(
    BytesBlob.blobFromParts([s_le, s_le, s_le, s_le, s_le, s_le, s_le, s_le]).raw,
    SEED_SIZE,
  ).asOpaque();
}

/**
 * Derives a Ed25519 secret key from a seed.
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#derivation-method
 */
export function deriveEd25519SecretKey(
  seed: KeySeed,
  blake2b: Blake2b,
): Ed25519SecretSeed {
  return blake2b.hashBytes(BytesBlob.blobFromParts([ED25519_SECRET_KEY.raw, seed.raw])).asOpaque();
}

/**
 * Derives a Bandersnatch secret key from a seed.
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#derivation-method
 */
export function deriveBandersnatchSecretKey(
  seed: KeySeed,
  blake2b: Blake2b,
): BandersnatchSecretSeed {
  return blake2b.hashBytes(BytesBlob.blobFromParts([BANDERSNATCH_SECRET_KEY.raw, seed.raw])).asOpaque();
}

/**
 * Derive Ed25519 public key from secret seed
 */
export async function deriveEd25519PublicKey(seed: Ed25519SecretSeed): Promise<Ed25519Key> {
  return (await privateKey(seed)).pubKey;
}

/**
 * Derive Bandersnatch public key from secret seed
 */
export function deriveBandersnatchPublicKey(seed: BandersnatchSecretSeed): BandersnatchKey {
  return publicKey(seed.raw);
}
