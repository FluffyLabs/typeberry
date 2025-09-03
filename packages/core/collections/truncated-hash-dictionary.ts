import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { TEST_COMPARE_USING } from "@typeberry/utils";
import { HashDictionary } from "./hash-dictionary.js";

type HashWithZeroedBit<T extends OpaqueHash> = T;

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
    entries: Iterable<[T | TruncatedHash, V]>,
  ): TruncatedHashDictionary<T, V> {
    /** Copy key bytes of an entry and replace the last one with 0. */
    const mapped = Array.from(entries).map<[T, V]>(([key, value]) => {
      const newKey: T = Bytes.zero(HASH_SIZE).asOpaque();
      newKey.raw.set(key.raw.subarray(0, TRUNCATED_HASH_SIZE));
      return [newKey, value];
    });
    return new TruncatedHashDictionary(HashDictionary.fromEntries(mapped));
  }

  /** A truncated key which we re-use to query the dictionary. */
  private readonly truncatedKey: T = Bytes.zero(HASH_SIZE).asOpaque();

  private constructor(private readonly dict: HashDictionary<HashWithZeroedBit<T>, V>) {}

  [TEST_COMPARE_USING]() {
    return this.dict;
  }

  /** Return number of items in the dictionary. */
  get size(): number {
    return this.dict.size;
  }

  /** Retrieve a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  get(fullKey: T | TruncatedHash): V | undefined {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE));
    return this.dict.get(this.truncatedKey);
  }

  /** Return true if the key is present in the dictionary */
  has(fullKey: T | TruncatedHash): boolean {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE));

    return this.dict.has(this.truncatedKey);
  }

  /** Set or update a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  set(fullKey: T | TruncatedHash, value: V) {
    // NOTE we can't use the the shared key here, since the collection will
    // store the key for us, hence the copy.
    const key = Bytes.zero(HASH_SIZE);
    key.raw.set(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE));
    this.dict.set(key.asOpaque(), value);
  }

  /** Remove a value that matches the key on `TRUNCATED_HASH_SIZE`. */
  delete(fullKey: T | TruncatedHash) {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE));
    this.dict.delete(this.truncatedKey);
  }

  /** Iterator over values of the dictionary. */
  values() {
    return this.dict.values();
  }

  /** Iterator over entries of the dictionary (with truncated keys) */
  *entries(): Generator<[TruncatedHash, V]> {
    for (const [key, value] of this.dict.entries()) {
      yield [Bytes.fromBlob(key.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE).asOpaque(), value];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}
