import { BytesBlob } from "@typeberry/bytes";
import type { Comparator } from "@typeberry/ordering";
import { asOpaqueType, assertNever, check, type Opaque, WithDebug } from "@typeberry/utils";

const CHUNK_SIZE = 6;
type CHUNK_SIZE = typeof CHUNK_SIZE;

/**
 * A function to transform a bytes chunk (up to 6 bytes into U48 number)
 *
 * Note that it uses 3 additional bits to store length(`value * 8 + len;`),
 * It is needed to distinguish shorter chunks that have 0s at the end, for example: [1, 2] and [1, 2, 0]
 * */
export function bytesAsU48(bytes: Uint8Array): number {
  const len = bytes.length;

  check`${len <= CHUNK_SIZE} Length has to be <= ${CHUNK_SIZE}, got: ${len}`;

  let value = 0;

  for (let i = 0; i < len; i++) {
    value = value * 256 + bytes[i];
  }

  return value * 8 + len;
}

type KeyChunk = Opaque<BytesBlob, `up to ${CHUNK_SIZE} bytes`>;
type U48 = number;
type SubKey<_K extends BytesBlob> = BytesBlob;
type OriginalKeyRef<K> = K;

type Leaf<K extends BytesBlob, V> = {
  key: OriginalKeyRef<K>;
  value: V;
};

class Node<K extends BytesBlob, V, C = MapChildren<K, V> | ListChildren<K, V>> {
  convertListChildrenToMap() {
    if (!(this.children instanceof ListChildren)) {
      return;
    }
    this.children = MapChildren.fromListNode<K, V>(this.children) as C;
  }

  static withList<K extends BytesBlob, V>(): Node<K, V, ListChildren<K, V>> {
    return new Node(undefined, ListChildren.new());
  }

  static withMap<K extends BytesBlob, V>(): Node<K, V, MapChildren<K, V>> {
    return new Node(undefined, MapChildren.new());
  }

  private constructor(
    private leaf: Leaf<K, V> | undefined,
    public children: C,
  ) {}

  getLeaf(): Leaf<K, V> | undefined {
    return this.leaf;
  }

  remove(_key: K): Leaf<K, V> | null {
    if (this.leaf === undefined) {
      return null;
    }

    const removedLeaf = this.leaf;
    this.leaf = undefined;
    return removedLeaf;
  }

  set(key: K, value: V): Leaf<K, V> | null {
    if (this.leaf === undefined) {
      this.leaf = { key, value };
      return this.leaf;
    }
    this.leaf.value = value;
    return null;
  }
}

class MapChildren<K extends BytesBlob, V> {
  children: Map<U48, Node<K, V>> = new Map();

  private constructor() {}

  static new<K extends BytesBlob, V>(): MapChildren<K, V> {
    return new MapChildren<K, V>();
  }

  static fromListNode<K extends BytesBlob, T>(node: ListChildren<K, T>): MapChildren<K, T> {
    const mapNode = new MapChildren<K, T>();

    for (const [key, leaf] of node.children) {
      const currentKeyChunk: KeyChunk = asOpaqueType(BytesBlob.blobFrom(key.raw.subarray(0, CHUNK_SIZE)));
      const subKey = BytesBlob.blobFrom(key.raw.subarray(CHUNK_SIZE));

      const child = mapNode.getChild(currentKeyChunk) ?? Node.withList<K, T>();
      const children = child?.children as ListChildren<K, T>;
      children.insert(subKey, leaf);
      mapNode.setChild(currentKeyChunk, child);
    }

    return mapNode;
  }

  getChild(keyChunk: KeyChunk) {
    const chunkAsNumber = bytesAsU48(keyChunk.raw);
    return this.children.get(chunkAsNumber);
  }

  setChild(keyChunk: KeyChunk, node: Node<K, V>) {
    const chunkAsNumber = bytesAsU48(keyChunk.raw);
    this.children.set(chunkAsNumber, node);
  }
}

export class ListChildren<K extends BytesBlob, V> {
  children: [SubKey<K>, Leaf<K, V>][] = [];

  private constructor() {}

  find(key: SubKey<K>): Leaf<K, V> | null {
    const result = this.children.find((item) => item[0].isEqualTo(key));
    if (result !== undefined) {
      return result[1];
    }
    return null;
  }

  remove(key: SubKey<K>): Leaf<K, V> | null {
    const existingIndex = this.children.findIndex((item) => item[0].isEqualTo(key));
    if (existingIndex >= 0) {
      const ret = this.children.splice(existingIndex, 1);
      return ret[0][1];
    }
    return null;
  }

  insert(key: SubKey<K>, leaf: Leaf<K, V>): Leaf<K, V> | null {
    const existingIndex = this.children.findIndex((item) => item[0].isEqualTo(key));
    if (existingIndex >= 0) {
      const existing = this.children[existingIndex];
      existing[1].value = leaf.value;
      return null;
    }

    this.children.push([key, leaf]);
    return leaf;
  }

  static new<K extends BytesBlob, V>() {
    return new ListChildren<K, V>();
  }
}

type MaybeNode<K extends BytesBlob, V> = Node<K, V> | undefined;

/** A map which uses byte blobs as keys */
export class BlobDictionary<K extends BytesBlob, V> extends WithDebug {
  /**
   * The root node of the dictionary.
   *
   * This is the main internal data structure that organizes entries
   * in a tree-like fashion (array-based nodes up to `mapNodeThreshold`,
   * map-based nodes beyond it). All insertions, updates, and deletions
   * operate through this structure.
   */
  private root: Node<K, V> = Node.withList();

  /**
   * Auxiliary map that stores references to the original keys and their values.
   *
   * - Overriding a value in the main structure does not replace the original key reference.
   * - Used for efficient iteration over `keys()`, `values()`, `entries()`, and computing `size`.
   */
  private keyvals: Map<K, Leaf<K, V>> = new Map();

  /**
   * Protected constructor used internally by `BlobDictionary.new`
   * and `BlobDictionary.fromEntries`.
   *
   * This enforces controlled instantiation — users should create instances
   * through the provided static factory methods instead of calling the
   * constructor directly.
   *
   * @param mapNodeThreshold - The threshold that determines when the dictionary
   * switches from using an array-based (`ListChildren`) node to a map-based (`MapChildren`) node for storing entries.
   */
  protected constructor(private mapNodeThreshold: number) {
    super();
  }

  /**
   * Returns the number of entries in the dictionary.
   *
   * The count is derived from the auxiliary `keyvals` map, which stores
   * all original key references and their associated values. This ensures
   * that the `size` reflects the actual number of entries, independent of
   * internal overrides in the main `root` structure.
   *
   * @returns The total number of entries in the dictionary.
   */
  get size(): number {
    return this.keyvals.size;
  }

  /**
   * Creates an empty `BlobDictionary`.
   *
   * @param mapNodeThreshold - The threshold that determines when the dictionary
   * switches from using an array-based (`ListChildren`) node to a map-based (`MapChildren`) node for storing entries.
   * Defaults to `0`.
   *
   * @returns A new, empty `BlobDictionary` instance.
   */
  static new<K extends BytesBlob, V>(mapNodeThreshold = 0) {
    return new BlobDictionary<K, V>(mapNodeThreshold);
  }

  /**
   * Creates a new `BlobDictionary` initialized with the given entries.
   *
   * @param entries - An array of `[key, value]` pairs used to populate the dictionary.
   * @param mapNodeThreshold - The threshold that determines when the dictionary
   * switches from using an array-based (`ListChildren`) node to a map-based (`MapChildren`) node for storing entries.
   * Defaults to `0`.
   *
   * @returns A new `BlobDictionary` containing the provided entries.
   */
  static fromEntries<K extends BytesBlob, V>(entries: [K, V][], mapNodeThreshold?: number): BlobDictionary<K, V> {
    const dict = BlobDictionary.new<K, V>(mapNodeThreshold);
    for (const [key, value] of entries) {
      dict.set(key, value);
    }
    return dict;
  }
  /**
   * Internal helper that inserts, updates or deletes an entry in the dictionary.
   *
   * Behaviour details:
   * - Passing `undefined` as `value` indicates a deletion. (E.g. `delete` uses `internalSet(key, undefined)`.)
   * - When an add (new entry) or a delete actually changes the structure, the method returns the affected leaf node.
   * - When the call only overrides an existing value (no structural add/delete), the method returns `null`.
   *
   * This method is intended for internal use by the dictionary implementation and allows `undefined` as a
   * sentinel value to signal removals.
   *
   * @param key - The key to insert, update or remove.
   * @param value - The value to associate with the key, or `undefined` to remove the key.
   * @returns The leaf node created or removed on add/delete, or `null` if the operation only overwrote an existing value.
   */
  private internalSet(key: K, value: V | undefined): Leaf<K, V> | null {
    let node: Node<K, V> = this.root;
    const keyChunkGenerator = key.chunks(CHUNK_SIZE);
    let depth = 0;

    for (;;) {
      const maybeKeyChunk = keyChunkGenerator.next().value;
      if (maybeKeyChunk === undefined) {
        if (value === undefined) {
          return node.remove(key);
        }
        return node.set(key, value);
      }

      const keyChunk: KeyChunk = asOpaqueType(maybeKeyChunk);

      if (node.children instanceof ListChildren) {
        const subkey = BytesBlob.blobFrom(key.raw.subarray(CHUNK_SIZE * depth));
        const leaf = value !== undefined ? node.children.insert(subkey, { key, value }) : node.children.remove(subkey);

        if (subkey.length > CHUNK_SIZE && node.children.children.length > this.mapNodeThreshold) {
          node.convertListChildrenToMap();
        }
        return leaf;
      }

      depth += 1;

      const children = node.children;
      if (children instanceof ListChildren) {
        throw new Error("We handle list node earlier. If we fall through, we know it's for the `Map` case.");
      }

      if (children instanceof MapChildren) {
        const maybeNode = children.getChild(keyChunk);

        if (maybeNode !== undefined) {
          // simply go one level deeper
          node = maybeNode;
        } else {
          // we are trying to remove an item, but it does not exist
          if (value === undefined) {
            return null;
          }

          // no more child nodes, we insert a new one.
          const newNode = Node.withList<K, V>();
          children.setChild(keyChunk, newNode);
          node = newNode;
        }
        continue;
      }

      assertNever(children);
    }
  }

  /**
   * Adds a new entry to the dictionary or updates the value of an existing key.
   *
   * If an entry with the given key already exists, its value is replaced
   * with the new one.
   *
   * @param key - The key to add or update in the dictionary.
   * @param value - The value to associate with the specified key.
   * @returns Nothing (`void`).
   */
  set(key: K, value: V): void {
    const leaf = this.internalSet(key, value);
    if (leaf !== null) {
      this.keyvals.set(leaf.key, leaf);
    }
  }

  /**
   * Retrieves the value associated with the given key from the dictionary.
   *
   * If the key does not exist, this method returns `undefined`.
   *
   * @param key - The key whose associated value should be retrieved.
   * @returns The value associated with the specified key, or `undefined` if the key is not present.
   */
  get(key: K): V | undefined {
    let node: MaybeNode<K, V> = this.root;
    const pathChunksGenerator = key.chunks(CHUNK_SIZE);
    let depth = 0;

    while (node !== undefined) {
      const maybePathChunk = pathChunksGenerator.next().value;

      if (node.children instanceof ListChildren) {
        const subkey = BytesBlob.blobFrom(key.raw.subarray(depth * CHUNK_SIZE));
        const child = node.children.find(subkey);
        if (child !== null) {
          return child.value;
        }
      }

      if (maybePathChunk === undefined) {
        return node.getLeaf()?.value;
      }

      if (node.children instanceof MapChildren) {
        const pathChunk: KeyChunk = asOpaqueType(maybePathChunk);
        node = node.children.getChild(pathChunk);
        depth += 1;
      }
    }

    return undefined;
  }

  /**
   * Checks whether the dictionary contains an entry for the given key.
   *
   * ⚠️ **Note:** Avoid using `has(...)` together with `get(...)` in a pattern like this:
   *
   * ```ts
   * if (dict.has(key)) {
   *   const value = dict.get(key);
   *   ...
   * }
   * ```
   *
   * This approach performs two lookups for the same key.
   *
   * Instead, prefer the following pattern, which retrieves the value once:
   *
   * ```ts
   * const value = dict.get(key);
   * if (value !== undefined) {
   *   ...
   * }
   * ```
   *
   * @param key - The key to check for.
   * @returns `true` if the dictionary contains an entry for the given key, otherwise `false`.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Removes an entry with the specified key from the dictionary.
   *
   * Internally, this calls {@link internalSet} with `undefined` to mark the entry as deleted.
   *
   * @param key - The key of the entry to remove.
   * @returns `true` if an entry was removed (i.e. the key existed), otherwise `false`.
   */
  delete(key: K): boolean {
    const leaf = this.internalSet(key, undefined);
    if (leaf !== null) {
      this.keyvals.delete(leaf.key);
      return true;
    }
    return false;
  }

  /**
   * Returns an iterator over the keys in the dictionary.
   *
   * The iterator yields each key in insertion order.
   *
   * @returns An iterator over all keys in the dictionary.
   */
  keys(): Iterator<K> & Iterable<K> {
    return this.keyvals.keys();
  }

  /**
   * Returns an iterator over the values in the dictionary.
   *
   * The iterator yields each value in insertion order.
   *
   * @returns An iterator over all values in the dictionary.
   */
  *values(): Iterator<V> & Iterable<V> {
    for (const leaf of this.keyvals.values()) {
      yield leaf.value;
    }
  }

  /**
   * Returns an iterator over the `[key, value]` pairs in the dictionary.
   *
   * The iterator yields entries in insertion order.
   *
   * @returns An iterator over `[key, value]` tuples for each entry in the dictionary.
   */
  *entries(): Iterator<[K, V]> & Iterable<[K, V]> {
    for (const leaf of this.keyvals.values()) {
      yield [leaf.key, leaf.value];
    }
  }

  /**
   * Default iterator for the dictionary.
   *
   * Equivalent to calling {@link entries}.
   * Enables iteration with `for...of`:
   *
   * ```ts
   * for (const [key, value] of dict) {
   *   ...
   * }
   * ```
   *
   * @returns An iterator over `[key, value]` pairs.
   */
  [Symbol.iterator](): Iterator<[K, V]> & Iterable<[K, V]> {
    return this.entries();
  }

  /**
   * Creates a new sorted array of values, ordered by their corresponding keys.
   *
   * Iterates over all entries in the dictionary and sorts them according
   * to the provided comparator function applied to the keys.
   *
   * @param comparator - A comparator function that can compare two keys.
   *
   * @returns A new array containing all values from the dictionary,
   * sorted according to their keys.
   */
  toSortedArray(comparator: Comparator<K>): V[] {
    const vals: [K, V][] = Array.from(this);
    vals.sort((a, b) => comparator(a[0], b[0]).value);
    return vals.map((x) => x[1]);
  }
}
