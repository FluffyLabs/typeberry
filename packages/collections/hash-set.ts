import type { OpaqueHash } from "@typeberry/hash";
import {HashDictionary} from "./hash-dictionary";

/** A set specialized for storing hashes. */
export class HashSet<V extends OpaqueHash> {
  private readonly map = new HashDictionary<V, boolean>();

  /** Return number of items in the set. */
  get size(): number {
    return this.map.size;
  }

  /** Insert given hash to the set. */
  insert(value: V) {
    this.map.set(value, true);
  }

  /** Check if given hash is in the set. */
  has(value: V) {
    this.map.has(value);
  }

  /** Remove value from set. */
  delete(value: V) {
    this.map.delete(value);
  }

  /** it allows to use HashSet in for-of loop */
  *[Symbol.iterator]() {
    for (const value of this.map) {
      yield value[0];
    }
  }
}
