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

class NodesDb {
	readonly hasher: TrieHasher;

	// TODO [ToDr] [crit] We can't use `TrieHash` directly in the map,
	// because of the way it's being compared. Hence having `string` here.
	// This has to be benchmarked and re-written to a custom map most likely.
	protected readonly nodes: Map<string, TrieNode>;

	constructor(hasher: TrieHasher) {
		this.hasher = hasher;
		this.nodes = new Map();
	}

	get(hash: TrieHash): TrieNode | null {
		return this.nodes.get(hash.toString()) ?? null;
	}
}

class WriteableNodesDb extends NodesDb {
	remove(branchHash: TrieHash) {
		// TODO [ToDr] implement me - currently no-op.
	}

	insert(node: TrieNode, hash?: TrieHash): TrieHash {
		const h = hash ?? hashNode(this.hasher, node);
		this.nodes.set(h.toString(), node);
		return h;
	}
}

export class InMemoryTrie {
	private readonly flat: Map<StateKey, BytesBlob> = new Map();
	private readonly nodes: WriteableNodesDb;
	private root: TrieNode | null = null;

	static empty(hasher: TrieHasher): InMemoryTrie {
		return new InMemoryTrie(new WriteableNodesDb(hasher));
	}

	constructor(nodes: WriteableNodesDb) {
		this.nodes = nodes;
	}

	set(key: StateKey, value: BytesBlob, maybeValueHash?: TrieHash) {
		this.flat.set(key, value);
		const valueHash =
			maybeValueHash ?? this.nodes.hasher.hashConcat(value.buffer);
		const leafNode = LeafNode.fromValue(key, value, valueHash);
		this.root = trieInsert(this.root, this.nodes, leafNode);
	}

	getRoot(): TrieHash {
		// TODO [ToDr] maybe we can just hash the root? We don't need to go down?
		return trieMerkleRoot(this.root, this.nodes);
	}
}

/**
 * Insert a new leaf node into a trie starting at the given `root` node.
 *
 * The function will find a place where the leaf node should be present and update
 * the entire branch up to the trie root.
 *
 * New root node is returned.
 */
function trieInsert(
	root: TrieNode | null,
	nodes: WriteableNodesDb,
	leaf: LeafNode,
): TrieNode {
	if (root === null) {
		nodes.insert(leaf.node);
		return leaf.node;
	}

	// first we look up a good place to insert the node to the tree, based on it's key.
	const traversedPath = findNodeToReplace(root, nodes, leaf.getKey());

	// now we analyze two possible situations:
	// 1. We found a leaf node - that means we need to create a branch node (and possible
	//    extra branch nodes for a common prefix) with these two leafs. Finally we update the
	//    traversed path from root.
	// 2. We found an empty spot (i.e. branch node with zero hash) - we can just update already
	//    traversed path from root.
	const nodeToInsert: [TrieNode, TrieHash] = traversedPath.leafToReplace
		? addBranchingAndInsertLeaf(
				traversedPath,
				nodes,
				traversedPath.leafToReplace,
				leaf,
			)
		: [leaf.node, nodes.insert(leaf.node)];

	// finally update the traversed path from `root` to the insertion location.
	let historicalBranch = traversedPath.branchingHistory.pop();
	let [lastNode, lastHash] = nodeToInsert;

	while (historicalBranch !== undefined) {
		const [branchNode, branchHash, bit] = historicalBranch;
		nodes.remove(branchHash);

		// TODO [ToDr] [opti] Avoid allocation here by re-using the old branch node?
		const newBranchNode = bit
			? BranchNode.fromSubNodes(branchNode.getLeft(), lastHash)
			: BranchNode.fromSubNodes(lastHash, branchNode.getRight());
		lastHash = nodes.insert(newBranchNode.node);
		lastNode = newBranchNode.node;

		historicalBranch = traversedPath.branchingHistory.pop();
	}

	return lastNode;
}

class TraversedPath {
	branchingHistory: [BranchNode, TrieHash, boolean][] = [];
	bitIndex = 0;
	leafToReplace?: [LeafNode, TrieHash];
}

function findNodeToReplace(
	root: TrieNode,
	nodes: NodesDb,
	key: TruncatedStateKey,
): TraversedPath {
	const traversedPath = new TraversedPath();
	let currentNode = root;
	let currentNodeHash = hashNode(nodes.hasher, root);

	while (true) {
		const kind = currentNode.getNodeType();
		if (kind !== NodeType.Branch) {
			// we found a leaf that needs to be merged with the one being inserted.
			const leaf = currentNode.asLeafNode();
			traversedPath.leafToReplace = [leaf, currentNodeHash];
			return traversedPath;
		}

		// going down the trie
		const branch = currentNode.asBranchNode();
		const currBit = getBit(key, traversedPath.bitIndex);
		const nextHash = currBit ? branch.getRight() : branch.getLeft();
		traversedPath.branchingHistory.push([branch, currentNodeHash, currBit]);

		const nextNode = nodes.get(nextHash);
		if (nextNode === null) {
			if (nextHash.isEqualTo(Bytes.zero(HASH_BYTES))) {
				return traversedPath;
			}

			throw new Error(
				`Missing trie node '${nextHash}' with key prefix: ${key}[0..${traversedPath.bitIndex}]`,
			);
		}

		currentNode = nextNode;
		currentNodeHash = nextHash;
		traversedPath.bitIndex += 1;
	}
}

function addBranchingAndInsertLeaf(
	traversedPath: TraversedPath,
	nodes: WriteableNodesDb,
	leafToReplace: [LeafNode, TrieHash],
	leaf: LeafNode,
): [TrieNode, TrieHash] {
	const key = leaf.getKey();
	const [existingLeaf, existingLeafHash] = leafToReplace;
	const existingLeafKey = existingLeaf.getKey();

	// TODO [ToDr] [opti] instead of inserting/removing a bunch of nodes, it might be
	// better to return a changeset that can be batch-applied to the DB.
	const leafNodeHash = nodes.insert(leaf.node);
	if (existingLeafKey.isEqualTo(key)) {
		// just replacing an existing value
		// TODO [ToDr] implement & test
		throw new Error("replacement is unimplemented yet");
	}

	// In case both keys share a prefix we need to add a bunch of branch
	// nodes up until the keys start diverging.
	// Here we identify the common bit prefix that will later be used
	// in reverse to construct required branch nodes.
	const commonBits: boolean[] = [];
	const maxBit = HASH_BYTES * 8;
	let divergingBit = getBit(key, traversedPath.bitIndex);
	while (traversedPath.bitIndex < maxBit) {
		divergingBit = getBit(key, traversedPath.bitIndex);
		const bit2 = getBit(existingLeafKey, traversedPath.bitIndex);
		if (divergingBit === bit2) {
			commonBits.push(bit2);
			traversedPath.bitIndex += 1;
		} else {
			break;
		}
	}

	// Now construct the common branches, and insert zero hash in place of other sub-trees.
	let lastBranch = divergingBit
		? BranchNode.fromSubNodes(existingLeafHash, leafNodeHash)
		: BranchNode.fromSubNodes(leafNodeHash, existingLeafHash);

	let lastHash = nodes.insert(lastBranch.node);
	let bit = commonBits.pop();
	const zero = Bytes.zero(HASH_BYTES) as TrieHash;

	// go up and create branch nodes for the common prefix
	while (bit !== undefined) {
		lastBranch = bit
			? BranchNode.fromSubNodes(zero, lastHash)
			: BranchNode.fromSubNodes(lastHash, zero);
		lastHash = nodes.insert(lastBranch.node);
		bit = commonBits.pop();
	}

	// let's return the top branch to join with the history
	return [lastBranch.node, lastHash];
}

function getBit(key: TruncatedStateKey, bitIndex: number): boolean {
	check(bitIndex <= 255);
	const byte = Math.floor(bitIndex / 8);
	const bit = bitIndex - byte * 8;
	const mask = 1 << bit;

	const val = key.raw[byte] & mask;
	return val > 0;
}

/**
 * Construct a sub-trie commitment given root node and the collection of inner nodes.
 *
 * This function will perform a Merkelization of the binary trie, as described in
 * section D.2 of the Gray Paper.
 *
 * We are going to traverse the trie starting from the leafs and concate and hash their
 * representations. We always concate two siblings (taking zero hash if there is only one leaf)
 * and move to the upper level to concate & hash the resulting hashes of the two child sub-tries.

 */
function trieMerkleRoot(root: TrieNode | null, nodes: NodesDb): TrieHash {
	if (root === null) {
		return Bytes.zero(HASH_BYTES) as TrieHash;
	}

	const kind = root.getNodeType();
	if (kind === NodeType.Branch) {
		const node = root.asBranchNode();
		// TODO [ToDr] [opti] maybe better to store children directly instead of going to the db?
		// it needs an extra step when writing to disk, but might be faster?
		// TODO [ToDr] [crit] avoid recursion
		const left = trieMerkleRoot(nodes.get(node.getLeft()), nodes);
		const right = trieMerkleRoot(nodes.get(node.getRight()), nodes);
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
		check(this.getNodeType() !== NodeType.Branch);
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

	static fromSubNodes(left: TrieHash, right: TrieHash) {
		const node = new TrieNode();
		node.data.set(left.raw, 0);
		node.data.set(right.raw, HASH_BYTES);
		// set the first bit to 0 (branch node)
		node.data[0] &= 0b1111_1110;

		return new BranchNode(node);
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
			this.node.data.subarray(1, TRUNCATED_KEY_BYTES + 1),
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
		const firstByte = this.node.data[0] >> 2;
		return firstByte;
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
