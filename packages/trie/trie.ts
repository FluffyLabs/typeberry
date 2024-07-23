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
		const key = NodesDb.hashCompatStr(hash);
		return this.nodes.get(key) ?? null;
	}

	/**
	 * Returns a string identifier of that hash to be used as a key in DB.
	 *
	 * Before calling `toString` the first bit is set to 0, to maintain compatibility
	 * with branch nodes, which have the left subtree stripped out of the first bit (since it's
	 * a branch node identifier).
	 *
	 */
	protected static hashCompatStr(hash: TrieHash): string {
		const prevValue = hash.raw[0];
		hash.raw[0] &= 0b1111_1110;
		const hashString = hash.toString();
		// restore the original byte, so that we have correct value in case it
		// ends up in the right part of the subtree.
		hash.raw[0] = prevValue;
		return hashString;
	}
}

class WriteableNodesDb extends NodesDb {
	remove(hash: TrieHash) {
		const key = NodesDb.hashCompatStr(hash);
		this.nodes.delete(key);
	}

	insert(node: TrieNode, hash?: TrieHash): TrieHash {
		const h = hash ?? hashNode(this.hasher, node);
		const key = NodesDb.hashCompatStr(h);
		this.nodes.set(key, node);
		return h;
	}
}

export class InMemoryTrie {
	private readonly flat: Map<string, BytesBlob> = new Map();
	private readonly nodes: WriteableNodesDb;
	private root: TrieNode | null = null;

	static empty(hasher: TrieHasher): InMemoryTrie {
		return new InMemoryTrie(new WriteableNodesDb(hasher));
	}

	constructor(nodes: WriteableNodesDb) {
		this.nodes = nodes;
	}

	set(key: StateKey, value: BytesBlob, maybeValueHash?: TrieHash) {
		this.flat.set(key.toString(), value);
		const valueHash =
			maybeValueHash ?? this.nodes.hasher.hashConcat(value.buffer);
		const leafNode = LeafNode.fromValue(key, value, valueHash);
		this.root = trieInsert(this.root, this.nodes, leafNode);
	}

	getRoot(): TrieHash {
		if (this.root === null) {
			return Bytes.zero(HASH_BYTES) as TrieHash;
		}

		return hashNode(this.nodes.hasher, this.root);
	}

	toString(): string {
		return trieStringify(this.root, this.nodes);
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
	//    extra branch nodes for a common prefix) with these two leaves. Finally we update the
	//    traversed path from root.
	// 2. We found an empty spot (i.e. branch node with zero hash) - we can just update already
	//    traversed path from root.
	const nodeToInsert: [TrieNode, TrieHash] = traversedPath.leafToReplace
		? createSubtreeForBothLeaves(
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

/**
 * Path of branch nodes traversed while looking for the best place to put a new leaf.
 */
class TraversedPath {
	/** history of branch nodes (with their hashes) and the branching bit. */
	branchingHistory: [BranchNode, TrieHash, boolean][] = [];
	/** last bitIndex */
	bitIndex = 0;
	/** in case of a leaf node at destination, details of that leaf node */
	leafToReplace?: [LeafNode, TrieHash];
}

/**
 * Traverse the trie starting from root and return the path leading to the destination
 * where leaf with `key` should be placed.
 */
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

/**
 * Handle a situation where we replace an existing leaf node at destination.
 *
 * In such case we need to create a subtree that will hold both of the leaves.
 *
 * The function returns a root of the subtree.
 */
function createSubtreeForBothLeaves(
	traversedPath: TraversedPath,
	nodes: WriteableNodesDb,
	leafToReplace: [LeafNode, TrieHash],
	leaf: LeafNode,
): [TrieNode, TrieHash] {
	const key = leaf.getKey();
	let [existingLeaf, existingLeafHash] = leafToReplace;
	const existingLeafKey = existingLeaf.getKey();

	// TODO [ToDr] [opti] instead of inserting/removing a bunch of nodes, it might be
	// better to return a changeset that can be batch-applied to the DB.
	const leafNodeHash = nodes.insert(leaf.node);
	if (existingLeafKey.isEqualTo(key)) {
		// just replacing an existing value
		nodes.remove(existingLeafHash);
		return [leaf.node, leafNodeHash];
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
	const zero = Bytes.zero(HASH_BYTES) as TrieHash;

	// In case we move the leaf from left to right it's hash needs to be re-calculated (missing bit).
	// TODO [ToDr] [opti] might be better to store the original bit value instead of recalculating.
	const leafWasInLeftBranch = (() => {
		const l = traversedPath.branchingHistory.length;
		if (l > 0) {
			return traversedPath.branchingHistory[l - 1][2] === false;
		}
		return false;
	})();
	if (leafWasInLeftBranch && !divergingBit) {
		existingLeafHash = hashNode(nodes.hasher, existingLeaf.node);
	}

	let lastBranch = divergingBit
		? BranchNode.fromSubNodes(existingLeafHash, leafNodeHash)
		: BranchNode.fromSubNodes(leafNodeHash, existingLeafHash);
	let lastHash = nodes.insert(lastBranch.node);
	let bit = commonBits.pop();

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

/**
 * Return a single bit from `key` located at `bitIndex`.
 */
function getBit(key: TruncatedStateKey, bitIndex: number): boolean {
	check(bitIndex <= 255);
	const byte = Math.floor(bitIndex / 8);
	const bit = bitIndex - byte * 8;
	const mask = 1 << bit;

	const val = key.raw[byte] & mask;
	return val > 0;
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

function trieStringify(root: TrieNode | null, nodes: NodesDb): string {
	if (root === null) {
		return "<empty tree>";
	}

	const kind = root.getNodeType();
	if (kind === NodeType.Branch) {
		const branch = root.asBranchNode();
		const leftHash = branch.getLeft();
		const rightHash = branch.getRight();
		const indent = (v: string) =>
			v
				.split("\n")
				.map((v) => `\t\t${v}`)
				.join("\n");
		const left = trieStringify(nodes.get(leftHash), nodes);
		const right = trieStringify(nodes.get(rightHash), nodes);

		return `<branch>
	-- ${leftHash}: ${indent(left)}
	-- ${rightHash}: ${indent(right)}
`;
	}

	const leaf = root.asLeafNode();
	const valueLength = leaf.getValueLength();
	const value =
		valueLength > 0
			? `'${leaf.getValue()}'(len:${valueLength})`
			: `'<hash>${leaf.getValueHash()}'`;
	return `\nLeaf('${leaf.getKey().toString()}',${value})`;
}

// TODO [ToDr] Split into multiple files.
