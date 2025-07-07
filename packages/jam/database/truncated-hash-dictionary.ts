import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { TRUNCATED_KEY_BYTES } from "@typeberry/trie";

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
    entries: [T | Bytes<TRUNCATED_KEY_BYTES>, V][],
  ): TruncatedHashDictionary<T, V> {
    /** Copy key bytes of an entry and replace the last one with 0. */
    const mapped = entries.map<[T, V]>(([key, value]) => {
      const newKey: T = Bytes.zero(HASH_SIZE).asOpaque();
      newKey.raw.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES));
      return [newKey, value];
    });
    return new TruncatedHashDictionary(HashDictionary.fromEntries(mapped));
  }

  /** A truncated key which we re-use to query the dictionary. */
  private readonly truncatedKey: T = Bytes.zero(HASH_SIZE).asOpaque();

  private constructor(private readonly dict: HashDictionary<HashWithZeroedBit<T>, V>) {}

  /** Retrieve a value that matches the key on `TRUNCATED_KEY_BYTES`. */
  public get(fullKey: T | Bytes<TRUNCATED_KEY_BYTES>): V | undefined {
    this.truncatedKey.raw.set(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES));
    return this.dict.get(this.truncatedKey);
  }

  [Symbol.iterator]() {
    return this.dict[Symbol.iterator]();
  }
}
