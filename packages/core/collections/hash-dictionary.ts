import type { OpaqueHash } from "@typeberry/hash";
import type { Comparator } from "@typeberry/ordering";

/** A map which uses hashes as keys. */
export class HashDictionary<K extends OpaqueHash, V> {
  // TODO [ToDr] [crit] We can't use `TrieHash` directly in the map,
  // because of the way it's being compared. Hence having `string` here.
  // This has to be benchmarked and re-written to a custom map most likely.
  private readonly map = new Map<string, [K, V]>();

  private constructor() {}

  /** Create a new, empty hash dictionary. */
  static new<K extends OpaqueHash, V>() {
    return new HashDictionary<K, V>();
  }

  /** Create a new hash dictionary from given entires array. */
  static fromEntries<K extends OpaqueHash, V>(entries: [K, V][]): HashDictionary<K, V> {
    const dict = new HashDictionary<K, V>();
    for (const [key, value] of entries) {
      dict.set(key, value);
    }
    return dict;
  }

  /** Return number of items in the dictionary. */
  get size(): number {
    return this.map.size;
  }

  /** Return true if the key is present in the dictionary. */
  has(key: K): boolean {
    return this.map.has(key.toString());
  }

  /** Get the value under given key or `null` if the value is not present. */
  get(key: K): V | undefined {
    return this.map.get(key.toString())?.[1];
  }

  /** Insert/overwrite the value at given key. */
  set(key: K, value: V) {
    this.map.set(key.toString(), [key, value]);
  }

  /**
   * Remove the key and any value from the dictionary.
   *
   * Returns `true` if element existed and was removed, `false` otherwise.
   */
  delete(key: K) {
    return this.map.delete(key.toString());
  }

  /** it allows to use HashDictionary in for-of loop */
  *[Symbol.iterator]() {
    for (const value of this.map.values()) {
      yield value;
    }
  }

  /** Iterator over keys of the dictionary. */
  *keys() {
    for (const value of this.map.values()) {
      yield value[0];
    }
  }

  /** Iterator over values of the dictionary. */
  *values() {
    for (const value of this.map.values()) {
      yield value[1];
    }
  }

  /** Returns an array of the map's values, sorted by their corresponding keys */
  toSortedArray(compare: Comparator<K>): V[] {
    const vals = Array.from(this.map.values());
    vals.sort((a, b) => compare(a[0], b[0]).value);
    return vals.map((x) => x[1]);
  }
}
