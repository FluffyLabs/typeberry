import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type U32, u32AsLeBytes } from "@typeberry/numbers";

const _ED25519_SECRET_KEY = "jam_val_key_ed25519" as const;
const _BANDERSNATCH_SECRET_KEY = "jam_val_key_bandersnatch" as const;

export function trivialSeed(s: U32): Bytes<32> {
  const s_le = u32AsLeBytes(s);
  return Bytes.fromBlob(BytesBlob.blobFromParts([s_le, s_le, s_le, s_le, s_le, s_le, s_le, s_le]).raw, 32);
}
