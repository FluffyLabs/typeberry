import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { WithDebug } from "@typeberry/utils";

/**
 * Size of the output of the hash functions.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/073101073c01
 *
 */
export const HASH_SIZE = 32;
export type HASH_SIZE = typeof HASH_SIZE;

/** A hash without last byte (useful for trie representation). */
export const TRUNCATED_HASH_SIZE = 31;
export type TRUNCATED_HASH_SIZE = typeof TRUNCATED_HASH_SIZE;

/** Opaque, unknown hash. */
export type OpaqueHash = Bytes<HASH_SIZE>;

/** Opaque Blake2B. */
export type Blake2bHash = Bytes<HASH_SIZE>;

/** Opaque KeccakHash. */
export type KeccakHash = Bytes<HASH_SIZE>;

/** Truncated hash. */
export type TruncatedHash = Bytes<TRUNCATED_HASH_SIZE>;

export const ZERO_HASH = Bytes.zero(HASH_SIZE);

/**
 * Container for some object with a hash that is related to this object.
 *
 * After calculating the hash these two should be passed together to avoid
 * unnecessary re-hashing of the data.
 */
export class WithHash<THash extends OpaqueHash, TData> extends WithDebug {
  // TODO [ToDr] use static method and make constructor private
  constructor(
    public readonly hash: THash,
    public readonly data: TData,
  ) {
    super();
  }
}

/**
 * Extension of [`WithHash`] additionally containing an encoded version of the object.
 */
export class WithHashAndBytes<THash extends OpaqueHash, TData> extends WithHash<THash, TData> {
  constructor(
    hash: THash,
    data: TData,
    public readonly encoded: BytesBlob,
  ) {
    super(hash, data);
  }
}
