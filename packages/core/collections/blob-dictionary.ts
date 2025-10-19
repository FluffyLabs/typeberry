import { BytesBlob } from "@typeberry/bytes";
import { assertNever, check } from "@typeberry/utils";

const CHUNK_SIZE = 6;

export interface Keyable extends BytesBlob {
  // chunks(chunkLength: number): Generator<BytesBlob, void, void>;
}

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
  value?: V | undefined;
  children: Map<number, MapNode<V> | ListNode<V>> = new Map();

  private constructor() {}

  static fromListNode<T>(node: ListNode<T>): MapNode<T> {
    const mapNode = new MapNode<T>();

    for (const [key, value] of node.children) {
      const currentKey = BytesBlob.blobFrom(key.raw.subarray(0, CHUNK_SIZE));
      const subKey = BytesBlob.blobFrom(key.raw.subarray(CHUNK_SIZE));
      const child = mapNode.getChild(currentKey) as ListNode<T> ?? ListNode.new<T>();
      
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
    return this.children.set(chunkAsNumber, node);
  }
}

export class ListNode<V> {
  value?: V | undefined;
  children: [Keyable, V][] = [];

  private constructor() {}

  find(key: Keyable) {
    const result = this.children.find(item => item[0].isEqualTo(key));
    if (result !== undefined) {
      return result[1];
    }
  }

  pushOrReplace(key: Keyable, value: V) {
    const existing = this.children.find(item => item[0].isEqualTo(key));
    if (existing !== undefined) {
      existing[1] = value;
    } else {
      this.children.push([key, value]);
    }
  }

  static new<V>() {
    return new ListNode<V>();
  }
}

type Node<V> = ListNode<V> | MapNode<V>;
type MaybeNode<V> = Node<V> | undefined;

export class BlobDictionary<K extends Keyable, V> {
  private root: Node<V> = ListNode.new<V>();
  private constructor(private mapNodeThreshold: number) {}

  static new<K extends Keyable, V>(mapNodeThreshold: number = 0) {
    return new BlobDictionary<K, V>(mapNodeThreshold);
  }

  private asNumbers(key: K): number[] {
    const numbers: number[] = [];
    const chunks = Array.from(key.chunks(CHUNK_SIZE));
    const chunksLength = chunks.length;

    for (let i = 0; i < chunksLength; i += 1) {
      const num = bytesAsU48(chunks[i].raw);
      numbers.push(num);
    }

    return numbers;
  }

  set(key: K, value: V): void {
    let node: MaybeNode<V> = this.root;
    const path = this.asNumbers(key);
    const keyChunkGenerator = key.chunks(CHUNK_SIZE);
    let depth = 0;
    while(node instanceof MapNode) {
      const keyChunk = keyChunkGenerator.next().value;
      if (keyChunk === undefined) {
        break;
      }

      const maybeNode = node.getChild(keyChunk);
      if (maybeNode instanceof MapNode) {
        node = maybeNode;
      } else if (maybeNode instanceof ListNode) {
        if (maybeNode.children.length >= this.mapNodeThreshold) {
          const mapNode: MapNode<V> = MapNode.fromListNode(maybeNode);
          node.setChild(keyChunk, mapNode)
          node = mapNode;
        } else {
          node = maybeNode;
        }
      } else {
        const newNode = ListNode.new<V>();
        const keyAsNumber = bytesAsU48(keyChunk.raw);
        node.children.set(keyAsNumber, newNode);
        break;
      }

      depth += 1;
    }

    const listNode = node as ListNode<V>; // it has to be list node here
    const subkey = key.raw.subarray(CHUNK_SIZE * depth);
    listNode.pushOrReplace(BytesBlob.blobFrom(subkey), value);
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
      node = node.getChild(pathChunk)
      depth += 1;
    }

    if (node instanceof MapNode) {
      return node.value;
    } else if (node instanceof ListNode) {
      const subkey = key.raw.subarray(depth * CHUNK_SIZE);
      return node.find(BytesBlob.blobFrom(subkey));
    } 
    assertNever(node as never);
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.set(key, undefined as V);
  }
}
