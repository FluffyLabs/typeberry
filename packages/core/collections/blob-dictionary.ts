import { BytesBlob } from "@typeberry/bytes";
import { assertNever, check, WithDebug } from "@typeberry/utils";

const CHUNK_SIZE = 6;

export interface Keyable extends BytesBlob {}

export function bytesAsU48(bytes: Uint8Array): number {
  const len = bytes.length;

  check`${len <= 6} Length has to be <= 6, got: ${len}`;

  let value = 0;

  for (let i = 0; i < len; i++) {
    value = value * 256 + bytes[i];
  }

  return value * 8 + len;
}

class MapNode<V> {
  key?: Keyable | undefined;
  value?: V | undefined;
  children: Map<number, MapNode<V> | ListNode<V>> = new Map();

  private constructor() {}

  static new<V>(): MapNode<V> {
    return new MapNode<V>();
  }

  static fromListNode<T>(node: ListNode<T>): MapNode<T> {
    const mapNode = new MapNode<T>();

    for (const [key, value] of node.children) {
      const currentKey = BytesBlob.blobFrom(key.raw.subarray(0, CHUNK_SIZE));
      const subKey = BytesBlob.blobFrom(key.raw.subarray(CHUNK_SIZE));
      const child = (mapNode.getChild(currentKey) as ListNode<T>) ?? ListNode.new<T>();

      if (subKey.length > 0) {
        child.pushOrReplace(subKey, value);
      } else {
        child.value = value;
      }

      mapNode.setChild(currentKey, child);
    }

    return mapNode;
  }

  getChild(keyChunk: Keyable) {
    const chunkAsNumber = bytesAsU48(keyChunk.raw);
    return this.children.get(chunkAsNumber);
  }

  setChild(keyChunk: Keyable, node: MapNode<V> | ListNode<V>) {
    const chunkAsNumber = bytesAsU48(keyChunk.raw);
    this.children.set(chunkAsNumber, node);
  }

  setValue(key: Keyable, value: V) {
    this.key = key;
    if (this.value !== undefined && value === undefined) {
      this.value = value;
      return OperationKind.Remove;
    }
    if (this.value === undefined && value !== undefined) {
      this.value = value;
      return OperationKind.Add;
    }

    this.value = value;
    return OperationKind.Override;
  }
}

enum OperationKind {
  Remove = -1,
  Override = 0,
  Add = 1,
}
export class ListNode<V> {
  value?: V | undefined;
  key?: Keyable | undefined;
  children: [Keyable, V][] = [];

  private constructor() {}

  find(key: Keyable) {
    const result = this.children.find((item) => item[0].isEqualTo(key));
    if (result !== undefined) {
      return result[1];
    }
  }

  pushOrReplace(key: Keyable, value: V): OperationKind {
    const existing = this.children.find((item) => item[0].isEqualTo(key));
    if (existing !== undefined) {
      existing[1] = value;
      if (existing[1] !== undefined && value === undefined) {
        return OperationKind.Remove;
      }

      return OperationKind.Override;
    }
    this.children.push([key, value]);
    return OperationKind.Add;
  }

  setValue(key: Keyable, value: V) {
    this.key = key;
    if (this.value !== undefined && value === undefined) {
      this.value = value;
      return OperationKind.Remove;
    }
    if (this.value === undefined && value !== undefined) {
      this.value = value;
      return OperationKind.Add;
    }

    this.value = value;
    return OperationKind.Override;
  }

  static new<V>() {
    return new ListNode<V>();
  }
}

type Node<V> = ListNode<V> | MapNode<V>;
type MaybeNode<V> = Node<V> | undefined;

export class BlobDictionary<K extends Keyable, V> extends WithDebug {
  private root: Node<V> = MapNode.new<V>();
  private keyvals: Map<Keyable, V> = new Map();

  private constructor(private mapNodeThreshold: number) {
    super();
  }

  get size(): number {
    return this.keyvals.size;
  }

  static new<K extends Keyable, V>(mapNodeThreshold = 0) {
    return new BlobDictionary<K, V>(mapNodeThreshold);
  }

  set(key: K, value: V): void {
    let node: MaybeNode<V> = this.root;
    const keyChunkGenerator = key.chunks(CHUNK_SIZE);
    let depth = 0;

    while (node instanceof MapNode) {
      const keyChunk = keyChunkGenerator.next().value;
      if (keyChunk === undefined) {
        break;
      }

      depth += 1;
      const maybeNode = node.getChild(keyChunk);

      if (maybeNode instanceof MapNode) {
        node = maybeNode;
      } else if (maybeNode instanceof ListNode) {
        if (maybeNode.children.length >= this.mapNodeThreshold) {
          const mapNode: MapNode<V> = MapNode.fromListNode(maybeNode);
          node.setChild(keyChunk, mapNode);
          node = mapNode;
        } else {
          node = maybeNode;
        }
      } else {
        const newNode = ListNode.new<V>();
        node.setChild(keyChunk, newNode);
        node = newNode;
      }
    }

    if (node instanceof MapNode) {
      const operation = node.setValue(key, value);
      this.updateKeyVals(operation, node.key ?? key, value);
    } else if (node instanceof ListNode) {
      const subkey = BytesBlob.blobFrom(key.raw.subarray(CHUNK_SIZE * depth));
      const operation = subkey.length > 0 ? node.pushOrReplace(subkey, value) : node.setValue(key, value);
      this.updateKeyVals(operation, node.key ?? key, value);
    } else {
      assertNever(node);
    }
  }

  private updateKeyVals(operation: OperationKind, key: Keyable, value: V) {
    if (operation === OperationKind.Add) {
      this.keyvals.set(key, value);
    } else if (operation === OperationKind.Override) {
      this.keyvals.set(key, value);
    } else {
      this.keyvals.delete(key);
    }
  }

  get(key: K): V | undefined {
    let node: MaybeNode<V> = this.root;
    const pathChunksGenerator = key.chunks(CHUNK_SIZE);
    let depth = 0;

    while (node instanceof MapNode) {
      const pathChunk = pathChunksGenerator.next().value;
      if (pathChunk === undefined) {
        break;
      }
      node = node.getChild(pathChunk);
      depth += 1;
    }

    if (node instanceof MapNode) {
      return node.value;
    }

    if (node instanceof ListNode) {
      const keyOffset = depth * CHUNK_SIZE;
      if (keyOffset >= key.length) {
        return node.value;
      }
      const subkey = BytesBlob.blobFrom(key.raw.subarray(depth * CHUNK_SIZE));
      return node.find(subkey);
    }

    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.set(key, undefined as V);
  }

  keys() {
    return this.keyvals.keys();
  }

  values() {
    return this.keyvals.values();
  }

  [Symbol.iterator]() {
    return this.keyvals.entries();
  }

  /** Create a new hash dictionary from given entires array. */
  static fromEntries<K extends Keyable, V>(entries: [K, V][]): BlobDictionary<K, V> {
    const dict = BlobDictionary.new<K, V>();
    for (const [key, value] of entries) {
      dict.set(key, value);
    }
    return dict;
  }
}
