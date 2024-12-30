import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import blake2b from "blake2b";

export function hashConcat<H extends OpaqueHash>(n: Uint8Array, rest?: Uint8Array[]): H {
  const hasher = blake2b(HASH_SIZE);
  hasher?.update(n);
  for (const v of rest ?? []) {
    hasher?.update(v);
  }
  // TODO [ToDr] plug in the allocator?
  const out = Bytes.zero(HASH_SIZE);
  hasher?.digest(out.raw);
  return out.asOpaque();
}

export function hashBlobs<H extends OpaqueHash>(r: BytesBlob[]): H {
  const first = r.shift();
  if (first === undefined) {
    return Bytes.zero(HASH_SIZE).asOpaque();
  }
  return hashConcat(
    first.raw,
    r.map((x) => x.raw),
  );
}
