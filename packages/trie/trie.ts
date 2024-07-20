import { Bytes, BytesBlob } from "../bytes";
import { check } from "../debug";
import type { Hash } from "../hash";
import type { Opaque } from "../opaque";

const HASH_BYTES = 32;
const TRUNCATED_KEY_BYTES = 31;

export type TrieHasher = {
	hashConcat(n: DataView, r?: DataView[]): TrieHash;
};

function hashNode(hasher: TrieHasher, n: TrieNode): TrieHash {
	return hasher.hashConcat(new DataView(n.data.buffer));
}

export type StateKey = Opaque<Bytes<32>, "stateKey">;
export type TruncatedStateKey = Opaque<Bytes<31>, "stateKey">;
export type TrieHash = Opaque<Hash, "trie">;
export type ValueHash = Opaque<Hash, "trieValue">;

export function parseStateKey(v: string): StateKey {
	return Bytes.parseBytesNoPrefix(v, HASH_BYTES) as StateKey;
}

export class StateDiff {
	diff: Map<StateKey, BytesBlob> = new Map();
}

class NodesDb {
	public hasher: TrieHasher;

	nodes: Map<TrieHash, TrieNode> = new Map();

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
	private flat: Map<StateKey, BytesBlob> = new Map();
	private root: TrieNode | null = null;
	private nodes: NodesDb;

	static empty(hasher: TrieHasher): InMemoryTrie {
		return new InMemoryTrie(new NodesDb(hasher));
	}

	constructor(nodes: NodesDb) {
		this.nodes = nodes;
	}

	set(key: StateKey, value: BytesBlob) {
		this.flat.set(key, value);
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
	data: Uint8Array = new Uint8Array();

	/** Returns the type of the node */
	getNodeType(): NodeType {
		if ((this.data[0] & 0x1) === 0x0) {
			return NodeType.Branch;
		}

		if ((this.data[0] & 0x01) === 0x10) {
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
	node: TrieNode;

	constructor(node: TrieNode) {
		this.node = node;
	}

	/** Get the hash of the left sub-trie. */
	getLeft(): TrieHash {
		// TODO [ToDr] what to do with the first bit?
		return new Bytes(
			new DataView(this.node.data.buffer, 0, HASH_BYTES),
			HASH_BYTES,
		) as TrieHash;
	}

	/** Get the hash of the right sub-trie. */
	getRight(): TrieHash {
		return new Bytes(
			new DataView(this.node.data.buffer, HASH_BYTES),
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
	node: TrieNode;

	constructor(node: TrieNode) {
		this.node = node;
	}

	/** Get the key (truncated to 31 bytes). */
	getKey(): TruncatedStateKey {
		return new Bytes(
			new DataView(this.node.data.buffer, 0, TRUNCATED_KEY_BYTES),
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
		const cleanByte = firstByte & 0b11111100;
		return cleanByte >> 2;
	}

	/**
	 * Returns the embedded value.
	 *
	 * @remark
	 * Note that this is going to be empty for a regular leaf node (i.e. containing a hash).
	 */
	getValue(): BytesBlob {
		const len = this.getValueLength();
		return new BytesBlob(
			this.node.data.buffer.slice(HASH_BYTES, HASH_BYTES + len),
		);
	}

	/**
	 * Returns contained value hash.
	 *
	 * @remark
	 * Note that for embedded value this is going to be full 0-padded 32 bytes.
	 */
	getValueHash(): ValueHash {
		return new Bytes(
			new DataView(this.node.data.buffer, HASH_BYTES),
			HASH_BYTES,
		) as ValueHash;
	}
}
