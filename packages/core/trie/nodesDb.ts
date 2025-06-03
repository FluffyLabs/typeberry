import { HashDictionary } from "@typeberry/collections";
import { FIRST_BIT_SET_NEG } from "./masks";
import { type LeafNode, NodeType, type TrieHash, type TrieNode } from "./nodes";

/**
 * Hasher used for the trie nodes.
 */
export type TrieHasher = {
  hashConcat(n: Uint8Array, r?: Uint8Array[]): TrieHash;
};

/**
 * An abstraction over read-only nodes storage.
 */
export class NodesDb {
  readonly hasher: TrieHasher;

  protected readonly nodes: HashDictionary<TrieHash, TrieNode>;

  constructor(hasher: TrieHasher) {
    this.hasher = hasher;
    this.nodes = HashDictionary.new();
  }

  get(hash: TrieHash): TrieNode | null {
    return NodesDb.withHashCompat(hash, (key) => {
      return this.nodes.get(key) ?? null;
    });
  }

  hashNode(n: TrieNode): TrieHash {
    return this.hasher.hashConcat(n.data);
  }

  *leaves(): Generator<[TrieHash, LeafNode]> {
    for (const [key, val] of this.nodes) {
      const nodeType = val.getNodeType();
      if (nodeType !== NodeType.Branch) {
        yield [key, val.asLeafNode()];
      }
    }
  }

  /**
   * Returns a string identifier of that hash to be used as a key in DB.
   *
   * Before calling `toString` the first bit is set to 0, to maintain compatibility
   * with branch nodes, which have the left subtree stripped out of the first bit
   * (since it's a branch node identifier).
   *
   */
  protected static withHashCompat<T>(hash: TrieHash, exe: (hash: TrieHash) => T): T {
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
  remove(hash: TrieHash) {
    return NodesDb.withHashCompat(hash, (key) => {
      this.nodes.delete(key);
    });
  }

  insert(node: TrieNode, hash?: TrieHash): TrieHash {
    const h = hash ?? this.hashNode(node);
    NodesDb.withHashCompat(h, (key) => {
      this.nodes.set(key, node);
    });
    return h;
  }
}
