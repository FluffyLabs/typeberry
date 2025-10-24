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

/** A map which uses byte blobs as keys */
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

export class BlobDictionary<K extends BytesBlob, V> extends WithDebug {
  private root: Node<K, V> = Node.withList();
  private keyvals: Map<K, Leaf<K, V>> = new Map();

  protected constructor(private mapNodeThreshold: number) {
    super();
  }

  get size(): number {
    return this.keyvals.size;
  }

  /** Create an empty blob dictionary */
  static new<K extends BytesBlob, V>(mapNodeThreshold = 0) {
    return new BlobDictionary<K, V>(mapNodeThreshold);
  }

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

  set(key: K, value: V): void {
    const leaf = this.internalSet(key, value);
    if (leaf !== null) {
      this.keyvals.set(leaf.key, leaf);
    }
  }

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

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const leaf = this.internalSet(key, undefined);
    if (leaf !== null) {
      this.keyvals.delete(leaf.key);
      return true;
    }
    return false;
  }

  keys(): Iterator<K> & Iterable<K> {
    return this.keyvals.keys();
  }

  *values(): Iterator<V> & Iterable<V> {
    for (const leaf of this.keyvals.values()) {
      yield leaf.value;
    }
  }

  *entries(): Iterator<[K, V]> & Iterable<[K, V]> {
    for (const leaf of this.keyvals.values()) {
      yield [leaf.key, leaf.value];
    }
  }

  [Symbol.iterator](): Iterator<[K, V]> & Iterable<[K, V]> {
    return this.entries();
  }

  /** Create a new blob dictionary from given entires array. */
  static fromEntries<K extends BytesBlob, V>(entries: [K, V][], mapNodeThreshold?: number): BlobDictionary<K, V> {
    const dict = BlobDictionary.new<K, V>(mapNodeThreshold);
    for (const [key, value] of entries) {
      dict.set(key, value);
    }
    return dict;
  }

  /** Create a new sorted array from the blob dictionary */
  toSortedArray(compare: Comparator<K>): V[] {
    const vals: [K, V][] = Array.from(this);
    vals.sort((a, b) => compare(a[0], b[0]).value);
    return vals.map((x) => x[1]);
  }
}
