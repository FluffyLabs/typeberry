import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type Opaque, check } from "@typeberry/utils";
import { FIRST_BIT_SET, FIRST_BIT_SET_NEG, FIRST_TWO_BITS_SET, FIRST_TWO_BITS_SET_NEG } from "./masks";

export type StateKey = Opaque<OpaqueHash, "trieStateKey">;
export type TruncatedStateKey = Opaque<Bytes<TRUNCATED_KEY_BYTES>, "trieStateKey">;

export type InputKey = StateKey | TruncatedStateKey;

/**
 * Hash of the entire node of the trie or concatenation of two nodes.
 *
 * In case this is the root node of the entire trie, it's going to be the state commitment.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0c1f010c2301
 */
export type TrieNodeHash = Opaque<OpaqueHash, "trie">;

/** Hash of the value contained in the trie node. */
export type ValueHash = Opaque<OpaqueHash, "trieValue">;

/** Value nodes have the key truncated to 31 bytes. */
export const TRUNCATED_KEY_BYTES = 31;
export type TRUNCATED_KEY_BYTES = 31;
export const TRUNCATED_KEY_BITS = TRUNCATED_KEY_BYTES * 8;

/** Number of bytes used to represent a trie node. */
export const TRIE_NODE_BYTES = 64;

export function parseInputKey(v: string): InputKey {
  if (v.length === HASH_SIZE * 2) {
    return Bytes.parseBytesNoPrefix(v, HASH_SIZE).asOpaque();
  }
  return Bytes.parseBytesNoPrefix(v, TRUNCATED_KEY_BYTES).asOpaque();
}

/**
 * The kind of the trie node.
 */
export enum NodeType {
  /** Branch node (left & right subtree hashes) */
  Branch = 0,
  /** Leaf node (value hash) */
  Leaf = 1,
  /** Embedded leaf node (value len + value) */
  EmbedLeaf = 2,
}

/**
 * A representation of an unidentified raw trie node.
 *
 * The node can be either (determined by the first bit):
 *	- a branch node
 *	- a leaf node
 *
 * In case of a branch node the contained data is:
 *	- left sub-node hash (32 bytes - 1 bit)
 *	- right sub-node hash (32 bytes)
 *
 * There are two kinds of leaf nodes (determined by the second bit)
 *	- Embedded value leaf nodes
 *	- Value hash leaf nodes
 *
 * Embedded value leaf nodes contain:
 *  - a length of the embedded value (last 6 bits of the first byte)
 *  - the value itself (padded with zeroes)
 *
 * Regular value leaf nodes contain:
 *  - a hash of the value
 */
export class TrieNode {
  constructor(
    /** Exactly 512 bits / 64 bytes */
    public readonly raw: Uint8Array = new Uint8Array(TRIE_NODE_BYTES),
  ) {}

  /** Returns the type of the node */
  getNodeType(): NodeType {
    if ((this.raw[0] & FIRST_BIT_SET) === 0) {
      return NodeType.Branch;
    }

    if ((this.raw[0] & FIRST_TWO_BITS_SET) === FIRST_TWO_BITS_SET) {
      return NodeType.Leaf;
    }

    return NodeType.EmbedLeaf;
  }

  /** View this node as a branch node */
  asBranchNode(): BranchNode {
    check(this.getNodeType() === NodeType.Branch);
    return new BranchNode(this);
  }

  /** View this node as a leaf node */
  asLeafNode(): LeafNode {
    check(this.getNodeType() !== NodeType.Branch);
    return new LeafNode(this);
  }

  toString() {
    return BytesBlob.blobFrom(this.raw).toString();
  }
}

/**
 * A branch node view of the underlying raw trie node.
 *
 * +---------------------------------------------------------------+
 * |                        512-bit trie node                      |
 * +---+----------------------------+------------------------------+
 * | B | Left Sub-node Hash         | Right Sub-node Hash          |
 * |   | (255 bits)                 | (256 bits)                   |
 * |---|----------------------------|------------------------------|
 * | 0 | 101010101010101010101...   | 11001100110011001100...      |
 * +---------------------------------------------------------------+
 */
export class BranchNode {
  // Underlying raw node.
  constructor(readonly node: TrieNode) {}

  static fromSubNodes(left: TrieNodeHash, right: TrieNodeHash) {
    const node = new TrieNode();
    node.raw.set(left.raw, 0);
    node.raw.set(right.raw, HASH_SIZE);

    // set the first bit to 0 (branch node)
    node.raw[0] &= FIRST_BIT_SET_NEG;

    return new BranchNode(node);
  }

  /** Get the hash of the left sub-trie. */
  getLeft(): TrieNodeHash {
    return Bytes.fromBlob(this.node.raw.subarray(0, HASH_SIZE), HASH_SIZE).asOpaque();
  }

  /** Get the hash of the right sub-trie. */
  getRight(): TrieNodeHash {
    return Bytes.fromBlob(this.node.raw.subarray(HASH_SIZE), HASH_SIZE).asOpaque();
  }
}

/**
 * A leaf node view of the underlying raw trie node.
 *
 * +---------------------------------------------------------------+
 * |                    Embedded value leaf                        |
 * +----+----------+-------------------+---------------------------+
 * | BL | V_len    | Key               | 0-padded value (V_len)    |
 * | 2b | (6 bits) | (31 bytes)        | (32 bytes)                |
 * |----|----------|-------------------|---------------------------|
 * | 10 |  000111  | deadbeef...       | 0123456789abcdef...       |
 * +---------------------------------------------------------------+
 * |                    Value hash leaf                            |
 * +----+----------+-------------------+---------------------------+
 * | BL |   zero   | Key               | Value hash                |
 * |----|----------|-------------------|---------------------------|
 * | 11 |  000000  | deadbeef...       | deadbeef...               |
 * +---------------------------------------------------------------+
 */
export class LeafNode {
  // Underlying raw node.
  readonly node: TrieNode;

  constructor(node: TrieNode) {
    this.node = node;
  }

  static fromValue(key: InputKey, value: BytesBlob, valueHash: () => ValueHash): LeafNode {
    const node = new TrieNode();
    // The value will fit in the leaf itself.
    if (value.length <= HASH_SIZE) {
      node.raw[0] = FIRST_BIT_SET | value.length;
      // truncate & copy the key
      node.raw.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES), 1);
      // copy the value
      node.raw.set(value.raw, TRUNCATED_KEY_BYTES + 1);
    } else {
      node.raw[0] = FIRST_TWO_BITS_SET;
      // truncate & copy the key
      node.raw.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES), 1);
      // copy the value hash
      node.raw.set(valueHash().raw, TRUNCATED_KEY_BYTES + 1);
    }

    return new LeafNode(node);
  }

  /** Get the key (truncated to 31 bytes). */
  getKey(): TruncatedStateKey {
    return Bytes.fromBlob(this.node.raw.subarray(1, TRUNCATED_KEY_BYTES + 1), TRUNCATED_KEY_BYTES).asOpaque();
  }

  hasEmbeddedValue(): boolean {
    return this.node.getNodeType() === NodeType.EmbedLeaf;
  }

  /**
   * Get the byte length of embedded value.
   *
   * @remark
   * Note in case this node only contains hash this is going to be 0.
   */
  getValueLength(): number {
    const firstByte = this.node.raw[0];
    // we only store values up to `HASH_SIZE`, so they fit on the last 6 bits.
    return firstByte & FIRST_TWO_BITS_SET_NEG;
  }

  /**
   * Returns the embedded value.
   *
   * @remark
   * Note that this is going to be empty for a regular leaf node (i.e. containing a hash).
   */
  getValue(): BytesBlob {
    const len = this.getValueLength();
    return BytesBlob.blobFrom(this.node.raw.subarray(HASH_SIZE, HASH_SIZE + len));
  }

  /**
   * Returns contained value hash.
   *
   * @remark
   * Note that for embedded value this is going to be full 0-padded 32 bytes.
   */
  getValueHash(): ValueHash {
    return Bytes.fromBlob(this.node.raw.subarray(HASH_SIZE), HASH_SIZE).asOpaque();
  }

  toString() {
    return `LeafNode {\n key: ${this.getKey()},\n valueHash: ${this.getValueHash()}\n}`;
  }
}
