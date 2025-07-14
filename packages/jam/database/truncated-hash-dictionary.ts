import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { TRUNCATED_KEY_BYTES } from "@typeberry/trie";

type HashWithZeroedBit<T extends OpaqueHash> = T;

/**
 * A collection of hash-based keys (likely `StateKey`s) which ignores
 * differences on the last byte.
 *
 * TODO [ToDr] introduce `TruncatedHash` into `@typeberry/hash` and move this
 * collection to `@typeberry/collections` (note it should not depend on trie)
 */
export class TruncatedHashDictionary<T extends OpaqueHash, V> {
  /**
   * Create a new `TruncatedHashDictionary` from given list of entries.
   *
   * Each key will be copied and have the last byte replace with a 0.
   */
  static fromEntries<T extends OpaqueHash, V>(
    entries: Iterable<[T | Bytes<TRUNCATED_KEY_BYTES>, V]>,
  ): TruncatedHashDictionary<T, V> {
    /** Copy key bytes of an entry and replace the last one with 0. */
    const mapped = Array.from(entries).map<[T, V]>(([key, value]) => {
      const newKey: T = Bytes.zero(HASH_SIZE).asOpaque();
      newKey.raw.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES));
      return [newKey, value];
    });
    return new TruncatedHashDictionary(HashDictionary.fromEntries(mapped));
  }

  /** A truncated key which we re-use to query the dictionary. */
  private readonly truncatedKey: T = Bytes.zero(HASH_SIZE).asOpaque();

  private constructor(private readonly dict: HashDictionary<HashWithZeroedBit<T>, V>) {}

  /** Return number of itemst in the dictionary. */
  get size(): number {
    return this.dict.size;
  }

  /** Retrieve a value that matches the key on `TRUNCATED_KEY_BYTES`. */
  get(fullKey: T | Bytes<TRUNCATED_KEY_BYTES>): V | undefined {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES));
    return this.dict.get(this.truncatedKey);
  }

  /** Return true if the key is present in the dictionary */
  has(fullKey: T | Bytes<TRUNCATED_KEY_BYTES>): boolean {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES));

    return this.dict.has(this.truncatedKey);
  }

  /** Set or update a value that matches the key on `TRUNCATED_KEY_BYTES`. */
  set(fullKey: T | Bytes<TRUNCATED_KEY_BYTES>, value: V) {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES));
    this.dict.set(this.truncatedKey, value);
  }

  /** Remove a value that matches the key on `TRUNCATED_KEY_BYTES`. */
  delete(fullKey: T | Bytes<TRUNCATED_KEY_BYTES>) {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES));
    this.dict.delete(this.truncatedKey);
  }

  /** Iterator over values of the dictionary. */
  values() {
    return this.dict.values();
  }

  [Symbol.iterator]() {
    return this.dict[Symbol.iterator]();
  }
}
