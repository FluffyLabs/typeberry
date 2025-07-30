import type { OpaqueHash } from "@typeberry/hash";
import type { Comparator } from "@typeberry/ordering";
import {TEST_COMPARE_USING} from "@typeberry/utils";

/** Immutable view of the `HashDictionary`. */
export interface ImmutableHashDictionary<K extends OpaqueHash, V> extends Iterable<[K, V]> {
  /** Return number of items in the dictionary. */
  get size(): number;
  /** Return true if the key is present in the dictionary. */
  has(key: K): boolean;
  /** Get the value under given key or `undefined` if the value is not present. */
  get(key: K): V | undefined;

  /** Iterator over keys of the dictionary. */
  keys(): Generator<K>;

  /** Iterator over values of the dictionary. */
  values(): Generator<V>;

  /** Returns an array of the map's values, sorted by their corresponding keys */
  toSortedArray(compare: Comparator<K>): V[];
}

/** A map which uses hashes as keys. */
export class HashDictionary<K extends OpaqueHash, V> implements ImmutableHashDictionary<K, V> {
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

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key.toString());
  }

  get(key: K): V | undefined {
    return this.map.get(key.toString())?.[1];
  }

  /** it allows to use HashDictionary in for-of loop */
  [Symbol.iterator]() {
    return this.map.values();
  }

  entries() {
    return this.map.values();
  }

  *keys() {
    for (const value of this.map.values()) {
      yield value[0];
    }
  }

  *values() {
    for (const value of this.map.values()) {
      yield value[1];
    }
  }

  toSortedArray(compare: Comparator<K>): V[] {
    const vals = Array.from(this.map.values());
    vals.sort((a, b) => compare(a[0], b[0]).value);
    return vals.map((x) => x[1]);
  }

  toJSON() {
    return Object.fromEntries(this);
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
}
