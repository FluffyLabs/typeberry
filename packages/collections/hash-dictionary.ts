import type { HASH_SIZE } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";

/** A map which uses hashes as keys. */
export class HashDictionary<K extends Bytes<typeof HASH_SIZE>, V> {
  // TODO [ToDr] [crit] We can't use `TrieHash` directly in the map,
  // because of the way it's being compared. Hence having `string` here.
  // This has to be benchmarked and re-written to a custom map most likely.
  private readonly map = new Map<string, V>();

  /** Return true if the key is present in the dictionary. */
  public has(key: K): boolean {
    return this.map.has(key.toString());
  }

  /** Get the value under given key or `null` if the value is not present. */
  public get(key: K): V | undefined {
    return this.map.get(key.toString());
  }

  /** Insert/overwrite the value at given key. */
  public set(key: K, value: V) {
    this.map.set(key.toString(), value);
  }

  /** Remove the key and any value from the dictionary. */
  public delete(key: K) {
    this.map.delete(key.toString());
  }
}
