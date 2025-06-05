import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, SimpleAllocator, blake2b } from "@typeberry/hash";
import { type U32, u32AsLeBytes } from "@typeberry/numbers";

const ED25519_SECRET_KEY = "jam_val_key_ed25519" as const;
const BANDERSNATCH_SECRET_KEY = "jam_val_key_bandersnatch" as const;

export function trivialSeed(s: U32): Bytes<32> {
  const s_le = u32AsLeBytes(s);
  return Bytes.fromBlob(BytesBlob.blobFromParts([s_le, s_le, s_le, s_le, s_le, s_le, s_le, s_le]).raw, 32);
}

export function generateEd25519SecretKey(seed: Bytes<32>, allocator?: SimpleAllocator): Blake2bHash {
  return blake2b.hashBytes(
    BytesBlob.blobFromParts([Bytes.blobFromString(ED25519_SECRET_KEY).raw, seed.raw]),
    allocator ?? new SimpleAllocator(),
  );
}

export function generateBandersnatchSecretKey(seed: Bytes<32>, allocator?: SimpleAllocator): Blake2bHash {
  return blake2b.hashBytes(
    BytesBlob.blobFromParts([Bytes.blobFromString(BANDERSNATCH_SECRET_KEY).raw, seed.raw]),
    allocator ?? new SimpleAllocator(),
  );
}
