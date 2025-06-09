import { HashDictionary } from "@typeberry/collections";
import { FIRST_BIT_SET_NEG } from "./masks";
import { type LeafNode, NodeType, type TrieNodeHash, type TrieNode } from "./nodes";

/** Hasher used for the trie nodes. */
export type TrieHasher = {
  hashConcat(n: Uint8Array, r?: Uint8Array[]): TrieNodeHash;
};

/** An abstraction over read-only nodes storage. */
export class NodesDb {
  protected readonly nodes: HashDictionary<TrieNodeHash, TrieNode> = HashDictionary.new();

  constructor(
    public readonly hasher: TrieHasher
  ) {}

  get(hash: TrieNodeHash): TrieNode | null {
    return NodesDb.withHashCompat(hash, (key) => {
      return this.nodes.get(key) ?? null;
    });
  }

  hashNode(n: TrieNode): TrieNodeHash {
    return this.hasher.hashConcat(n.raw);
  }

  *leaves(): Generator<LeafNode> {
    // TODO [ToDr] Perhaps we could avoid iterating over all nodes?
    for (const val of this.nodes.values()) {
      const nodeType = val.getNodeType();
      if (nodeType !== NodeType.Branch) {
        yield val.asLeafNode();
      }
    }
  }

  /**
   * Returns a string identifier of that hash to be used as a key in DB.
   *
   * Before calling `toString` the first bit is set to 0, to maintain compatibility
   * with branch nodes, which have the left subtree stripped out of the first bit
   * (since it's a branch node identifier).
   */
  protected static withHashCompat<T>(hash: TrieNodeHash, exe: (hash: TrieNodeHash) => T): T {
    const prevValue = hash.raw[0];
    hash.raw[0] &= FIRST_BIT_SET_NEG;
    const returnValue = exe(hash);
    // restore the original byte, so that we have correct value in case it
    // ends up in the right part of the subtree.
    hash.raw[0] = prevValue;
    return returnValue;
  }
}

/**
 * A version of `NodesDb` augmented with mutating methods.
 */
export class WriteableNodesDb extends NodesDb {
  remove(hash: TrieNodeHash) {
    return NodesDb.withHashCompat(hash, (key) => {
      this.nodes.delete(key);
    });
  }

  insert(node: TrieNode, hash?: TrieNodeHash): TrieNodeHash {
    const h = hash ?? this.hashNode(node);
    NodesDb.withHashCompat(h, (key) => {
      this.nodes.set(key, node);
    });
    return h;
  }
}
