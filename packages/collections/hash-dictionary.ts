import type { OpaqueHash } from "@typeberry/hash";

/** A map which uses hashes as keys. */
export class HashDictionary<K extends OpaqueHash, V> {
  // TODO [ToDr] [crit] We can't use `TrieHash` directly in the map,
  // because of the way it's being compared. Hence having `string` here.
  // This has to be benchmarked and re-written to a custom map most likely.
  protected readonly map = new Map<string, [K, V]>();

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

  /** Remove the key and any value from the dictionary. */
  delete(key: K) {
    this.map.delete(key.toString());
  }

  /** it allows to use HashDictionary in for-of loop */
  *[Symbol.iterator]() {
    for (const value of this.map.values()) {
      yield value;
    }
  }
}
