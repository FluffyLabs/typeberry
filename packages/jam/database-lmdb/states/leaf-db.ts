import {StateRootHash} from "@typeberry/block";
import {BytesBlob} from "@typeberry/bytes";
import {Persistence} from "@typeberry/state-merkleization/state-serialized";
import {InMemoryTrie, LeafNode, StateKey, TrieNode } from "@typeberry/trie";
import {blake2bTrieHasher} from "@typeberry/trie/hasher";
import {assertNever, Result} from "@typeberry/utils";
import {TruncatedHashDictionary} from "./truncated-hash-dictionary";
import {NodeType, TRIE_NODE_BYTES} from "@typeberry/trie/nodes";

/** Error during `LeafDb` creation. */
export enum LeafDbError {
  InvalidLeafData,
}

/** Abstraction over access to values that don't fit into leaves. */
export interface ValuesDb {
  /**
   * Retrieve a value under given key.
   *
   * Missing value is considered an irrecoverable error, so the implementations
   * are free to throw if that happens.
   */
  get(key: Uint8Array): Uint8Array;
}

enum LookupKind {
  EmbeddedValue,
  DbKey,
}

type Lookup = {
  kind: LookupKind.EmbeddedValue,
  value: BytesBlob,
} | {
  kind: LookupKind.DbKey,
  key: Uint8Array,
};

/**
 * Read the collection of leaf nodes and covert it into a Map-like structure.
 *
 * Note that reading the actual values may require accessing the original database.
 */
export class LeafDb implements Persistence {
  /**
   * Parse given blob containing concatenated leaf nodes into leaf db.
   */
  static fromLeafsBlob(
    blob: BytesBlob,
    dbPrefix: BytesBlob,
    db: ValuesDb,
  ): Result<LeafDb, LeafDbError> {
    if (blob.length % TRIE_NODE_BYTES !== 0) {
      return Result.error(LeafDbError.InvalidLeafData, `${blob.length} is not a multiply of ${TRIE_NODE_BYTES}: ${blob}`);
    }

    const leaves: LeafNode[] = [];
    for (const nodeData of blob.chunks(TRIE_NODE_BYTES)) {
      const node = new TrieNode(nodeData.raw)
      if (node.getNodeType() === NodeType.Branch) {
        return Result.error(LeafDbError.InvalidLeafData, `Branch node detected: ${nodeData}`);
      }
      leaves.push(node.asLeafNode());
    }

    return Result.ok(new LeafDb(leaves, dbPrefix, db));
  }

  /** A mapping between an embedded value or db lookup key. */
  private readonly lookup: TruncatedHashDictionary<StateKey, Lookup>;

  private constructor(
    private readonly leaves: LeafNode[],
    dbPrefix: BytesBlob,
    private readonly db: ValuesDb,
  ) {
    this.lookup = TruncatedHashDictionary.fromEntries(leaves.map(leaf => {
      const key: StateKey = leaf.getKey().asOpaque();
      const value: Lookup = leaf.hasEmbeddedValue() ? {
        kind: LookupKind.EmbeddedValue,
        value: leaf.getValue(),
      } : {
        kind: LookupKind.DbKey,
        key: BytesBlob.blobFromParts(dbPrefix.raw, leaf.getValueHash().raw).raw,
      };
      return [key, value];
    }));
  }

  get(key: StateKey): BytesBlob | null {
    const val = this.lookup.get(key);
    if (val === undefined) {
      return null;
    }

    if (val.kind === LookupKind.EmbeddedValue) {
      return val.value;
    }

    if (val.kind === LookupKind.DbKey) {
      return BytesBlob.blobFrom(this.db.get(val.key));
    }

    assertNever(val);
  }

  getStateRoot(): StateRootHash {
    return InMemoryTrie.computeStateRoot(blake2bTrieHasher, this.leaves).asOpaque();
  }
}
