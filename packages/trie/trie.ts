import { Bytes, BytesBlob } from "../bytes";
import { check } from "../debug";
import type { Hash } from "../hash";
import type { Opaque } from "../opaque";

export const HASH_BYTES = 32;
const TRUNCATED_KEY_BYTES = 31;

export type TrieHasher = {
	hashConcat(n: Uint8Array, r?: Uint8Array[]): TrieHash;
};

function hashNode(hasher: TrieHasher, n: TrieNode): TrieHash {
	return hasher.hashConcat(n.data);
}

export type StateKey = Opaque<Bytes<32>, "stateKey">;
export type TruncatedStateKey = Opaque<Bytes<31>, "stateKey">;
export type TrieHash = Opaque<Hash, "trie">;
export type ValueHash = Opaque<Hash, "trieValue">;

export function parseStateKey(v: string): StateKey {
	return Bytes.parseBytesNoPrefix(v, HASH_BYTES) as StateKey;
}

export class StateDiff {
	readonly diff: Map<StateKey, BytesBlob> = new Map();
}

class NodesDb {
	readonly hasher: TrieHasher;

	private readonly nodes: Map<TrieHash, TrieNode> = new Map();

	constructor(hasher: TrieHasher) {
		this.hasher = hasher;
	}

	put(node: TrieNode, hash?: TrieHash) {
		const h = hash ?? hashNode(this.hasher, node);
		this.nodes.set(h, node);
	}

	get(hash: TrieHash): TrieNode | null {
		return this.nodes.get(hash) ?? null;
	}
}

export class InMemoryTrie {
	private readonly flat: Map<StateKey, BytesBlob> = new Map();
	private readonly nodes: NodesDb;
	private root: TrieNode | null = null;

	static empty(hasher: TrieHasher): InMemoryTrie {
		return new InMemoryTrie(new NodesDb(hasher));
	}

	constructor(nodes: NodesDb) {
		this.nodes = nodes;
	}

	set(key: StateKey, value: BytesBlob, maybeValueHash?: TrieHash) {
		this.flat.set(key, value);
		const valueHash =
			maybeValueHash ?? this.nodes.hasher.hashConcat(value.buffer);
		this.root = LeafNode.fromValue(key, value, valueHash).node;
	}

	getRoot(): TrieHash {
		return merkelize(this.root, this.nodes);
	}
}

function merkelize(root: TrieNode | null, nodes: NodesDb): TrieHash {
	if (root === null) {
		return Bytes.zero(HASH_BYTES) as TrieHash;
	}

	const kind = root.getNodeType();
	if (kind === NodeType.Branch) {
		const node = root.asBranchNode();
		// TODO [ToDr] maybe better to store children directly instead of going to the db?
		// it needs an extra step when writing to disk, but might be faster?
		// TODO [ToDr] avoid recursion
		const left = merkelize(nodes.get(node.getLeft()), nodes);
		const right = merkelize(nodes.get(node.getRight()), nodes);
		return nodes.hasher.hashConcat(left.raw, [right.raw]);
	}

	return hashNode(nodes.hasher, root);
}

export enum NodeType {
	Branch = 0,
	Leaf = 1,
	EmbedLeaf = 2,
}

/**
 * A representation of an unidentified raw trie node.
 *
 * The node can be either (determined by the first bit):
 *  - a branch node
 *  - a leaf node
 *
 * In case of a branch node the contained data is:
 *	- left sub-node hash (32 bytes - 1 bit)
 *	- right sub-node hash (32 bytes)
 *
 * There are two kinds of leaf nodes (determined by the second bit)
 *  - Embedded value leaf nodes
 *	- Value hash leaf nodes
 *
 * Embedded value leaf nodes contain
 */
export class TrieNode {
	/** Exactly 512 bits / 64 bytes */
	readonly data: Uint8Array = new Uint8Array(64);

	/** Returns the type of the node */
	getNodeType(): NodeType {
		if ((this.data[0] & 0b1) === 0b0) {
			return NodeType.Branch;
		}

		if ((this.data[0] & 0b11) === 0b11) {
			return NodeType.EmbedLeaf;
		}

		return NodeType.Leaf;
	}

	/** View this node as a branch node */
	asBranchNode(): BranchNode {
		check(this.getNodeType() === NodeType.Branch);
		return new BranchNode(this);
	}

	/** View this node as a leaf node */
	asLeafNode(): LeafNode {
		check(this.getNodeType() === NodeType.Branch);
		return new LeafNode(this);
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
	readonly node: TrieNode;

	constructor(node: TrieNode) {
		this.node = node;
	}

	/** Get the hash of the left sub-trie. */
	getLeft(): TrieHash {
		// TODO [ToDr] what to do with the first bit?
		return new Bytes(
			this.node.data.subarray(0, HASH_BYTES),
			HASH_BYTES,
		) as TrieHash;
	}

	/** Get the hash of the right sub-trie. */
	getRight(): TrieHash {
		return new Bytes(
			this.node.data.subarray(HASH_BYTES),
			HASH_BYTES,
		) as TrieHash;
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
 * |                    Value value leaf                        |
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

	static fromValue(
		key: StateKey,
		value: BytesBlob,
		valueHash: TrieHash,
	): LeafNode {
		const node = new TrieNode();
		// The value will fit in the leaf itself.
		if (value.length <= HASH_BYTES) {
			node.data[0] = value.length << 2;
			node.data[0] |= 0b01;
			// truncate & copy the key
			node.data.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES), 1);
			// copy the value
			node.data.set(value.buffer, TRUNCATED_KEY_BYTES + 1);
		} else {
			node.data[0] = 0b11;
			// truncate & copy the key
			node.data.set(key.raw.subarray(0, TRUNCATED_KEY_BYTES), 1);
			// copy the value hash
			node.data.set(valueHash.raw, TRUNCATED_KEY_BYTES + 1);
		}

		return new LeafNode(node);
	}

	/** Get the key (truncated to 31 bytes). */
	getKey(): TruncatedStateKey {
		return new Bytes(
			this.node.data.subarray(0, TRUNCATED_KEY_BYTES),
			TRUNCATED_KEY_BYTES,
		) as TruncatedStateKey;
	}

	/**
	 * Get the byte length of embedded value.
	 *
	 * @remark
	 * Note in case this node only contains hash this is going to be 0.
	 */
	getValueLength(): number {
		const firstByte = this.node.data[0];
		// clean the first two bits
		const cleanByte = firstByte & 0b0011_1111;
		return cleanByte;
	}

	/**
	 * Returns the embedded value.
	 *
	 * @remark
	 * Note that this is going to be empty for a regular leaf node (i.e. containing a hash).
	 */
	getValue(): BytesBlob {
		const len = this.getValueLength();
		return new BytesBlob(this.node.data.subarray(HASH_BYTES, HASH_BYTES + len));
	}

	/**
	 * Returns contained value hash.
	 *
	 * @remark
	 * Note that for embedded value this is going to be full 0-padded 32 bytes.
	 */
	getValueHash(): ValueHash {
		return new Bytes(
			this.node.data.subarray(HASH_BYTES),
			HASH_BYTES,
		) as ValueHash;
	}
}
