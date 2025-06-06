import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, SimpleAllocator, blake2b } from "@typeberry/hash";
import { type U32, u32AsLeBytes } from "@typeberry/numbers";
import { type Ed25519Key, privateKey } from "./ed25519";

export const SEED_SIZE = 32;
export type SEED_SIZE = typeof SEED_SIZE;

const ED25519_SECRET_KEY = "jam_val_key_ed25519" as const;
const BANDERSNATCH_SECRET_KEY = "jam_val_key_bandersnatch" as const;

/**
 * JIP-5: Secret key derivation
 *
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md */

/**
 * Deriving a 32-byte seed from a 32-bit unsigned integer
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#trivial-seeds
 */
export function trivialSeed(s: U32): Bytes<SEED_SIZE> {
  const s_le = u32AsLeBytes(s);
  return Bytes.fromBlob(BytesBlob.blobFromParts([s_le, s_le, s_le, s_le, s_le, s_le, s_le, s_le]).raw, SEED_SIZE);
}

/**
 * Derives a Ed25519 secret key from a seed.
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#derivation-method
 */
export function deriveEd25519SecretKey(
  seed: Bytes<SEED_SIZE>,
  allocator: SimpleAllocator = new SimpleAllocator(),
): Blake2bHash {
  return blake2b.hashBytes(
    BytesBlob.blobFromParts([Bytes.blobFromString(ED25519_SECRET_KEY).raw, seed.raw]),
    allocator,
  );
}

/**
 * Derives a Bandersnatch secret key from a seed.
 * https://github.com/polkadot-fellows/JIPs/blob/7048f79edf4f4eb8bfe6fb42e6bbf61900f44c65/JIP-5.md#derivation-method
 */
export function deriveBandersnatchSecretKey(
  seed: Bytes<SEED_SIZE>,
  allocator: SimpleAllocator = new SimpleAllocator(),
): Blake2bHash {
  return blake2b.hashBytes(
    BytesBlob.blobFromParts([Bytes.blobFromString(BANDERSNATCH_SECRET_KEY).raw, seed.raw]),
    allocator,
  );
}

/**
 * Derive Ed25519 public key from secret seed
 */
export async function deriveEd25519PublicKey(seed: Bytes<SEED_SIZE>): Promise<Ed25519Key> {
  return (await privateKey(seed)).pubKey;
}
