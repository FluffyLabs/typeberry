import type { OpaqueHash } from "@typeberry/hash";
import { HashDictionary } from "./hash-dictionary.js";

/** A set specialized for storing hashes. */
export class HashSet<V extends OpaqueHash> {
  /** Wrap given dictionary into `HashSet` api for it's keys. */
  static viewDictionaryKeys<V extends OpaqueHash>(dict: HashDictionary<V, unknown>): HashSet<V> {
    return new HashSet(dict);
  }

  /** Create new set from given array of values. */
  static from<V extends OpaqueHash>(values: V[]): HashSet<V> {
    const newSet = HashSet.new<V>();
    newSet.insertAll(values);
    return newSet;
  }

  /** Create an empty set of hashes. */
  static new<V extends OpaqueHash>(): HashSet<V> {
    return new HashSet();
  }

  private constructor(private readonly map = HashDictionary.new<V, unknown>()) {}

  /** Return number of items in the set. */
  get size(): number {
    return this.map.size;
  }

  /** Insert given hash to the set. */
  insert(value: V) {
    return this.map.set(value, true);
  }

  /** Insert multiple items to the set. */
  insertAll(values: V[]) {
    for (const v of values) {
      this.map.set(v, true);
    }
  }

  /** Check if given hash is in the set. */
  has(value: V) {
    return this.map.has(value);
  }

  /**
   * Return an iterator over elements that are in the intersection of both sets.
   * i.e. they exist in both.
   */
  *intersection(other: HashSet<V>) {
    const iterate = this.size < other.size ? this : other;
    const second = iterate === this ? other : this;

    for (const elem of iterate) {
      if (second.has(elem)) {
        yield elem;
      }
    }
  }

  /**
   * Remove value from set.
   *
   * Returns `true` if element existed in the set and was removed, `false` otherwise.
   */
  delete(value: V) {
    return this.map.delete(value);
  }

  /** it allows to use HashSet in for-of loop */
  *[Symbol.iterator]() {
    for (const value of this.map) {
      yield value[0];
    }
  }
}
