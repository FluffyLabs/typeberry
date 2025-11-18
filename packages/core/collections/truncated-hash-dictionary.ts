import { Bytes } from "@typeberry/bytes";
import { type OpaqueHash, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { TEST_COMPARE_USING } from "@typeberry/utils";
import { BlobDictionary } from "./blob-dictionary.js";

function getTruncatedKey(key: OpaqueHash | TruncatedHash) {
  // Always return exactly TRUNCATED_HASH_SIZE bytes.
  if (key.length === TRUNCATED_HASH_SIZE) {
    return key;
  }

  return Bytes.fromBlob(key.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE);
}

/**
 * A value that indicates when `BlobDictionary` transforms Array nodes into Map nodes.
 * In practice, it doesn't matter much because, in real life, arrays in this structure usually have a length close to 1.
 */
const BLOB_DICTIONARY_THRESHOLD = 5;

/**
 * A collection of hash-based keys (likely `StateKey`s) which ignores
 * differences on the last byte.
 */
export class TruncatedHashDictionary<T extends OpaqueHash, V> {
  /**
   * Create a new `TruncatedHashDictionary` from given list of entries.
   *
   * Each key will be copied and have the last byte replace with a 0.
   */
  static fromEntries<T extends OpaqueHash, V>(
    entries: Iterable<[T | TruncatedHash, V] | readonly [T | TruncatedHash, V]>,
  ): TruncatedHashDictionary<T, V> {
    return new TruncatedHashDictionary(
      BlobDictionary.fromEntries<TruncatedHash, V>(
        Array.from(entries).map(([key, value]) => [getTruncatedKey(key), value]),
        BLOB_DICTIONARY_THRESHOLD,
      ),
    );
  }

  private constructor(private readonly dict: BlobDictionary<TruncatedHash, V>) {}

  [TEST_COMPARE_USING]() {
    return Array.from(this.dict);
  }

  /** Return number of items in the dictionary. */
  get size(): number {
    return this.dict.size;
  }

  /** Retrieve a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  get(key: T | TruncatedHash): V | undefined {
    const truncatedKey = getTruncatedKey(key);
    return this.dict.get(truncatedKey);
  }

  /** Return true if the key is present in the dictionary */
  has(key: T | TruncatedHash): boolean {
    const truncatedKey = getTruncatedKey(key);
    return this.dict.has(truncatedKey);
  }

  /** Set or update a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  set(key: T | TruncatedHash, value: V) {
    const truncatedKey = getTruncatedKey(key);
    this.dict.set(truncatedKey, value);
  }

  /** Remove a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  delete(key: T | TruncatedHash) {
    const truncatedKey = getTruncatedKey(key);
    this.dict.delete(truncatedKey);
  }

  /** Iterator over values of the dictionary. */
  values() {
    return this.dict.values();
  }

  /** Iterator over entries of the dictionary (with truncated keys) */
  *entries(): Generator<[TruncatedHash, V]> {
    yield* this.dict.entries();
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}
