import type { OpaqueHash } from "@typeberry/hash";
import { HashDictionary } from "./hash-dictionary";

/** A set specialized for storing hashes. */
export class HashSet<V extends OpaqueHash> {
  private readonly map = new HashDictionary<V, boolean>();

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
  intersection(other: HashSet<V>) {
    const iterate = this.size < other.size ? this : other;
    const second = iterate === this ? other : this;

    return {
      *[Symbol.iterator]() {
        for (const elem of iterate) {
          if (second.has(elem)) {
            yield elem;
          }
        }
      },
    };
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
