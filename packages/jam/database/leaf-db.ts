import type { StateRootHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { SortedSet, TruncatedHashDictionary } from "@typeberry/collections";
import type { Blake2b } from "@typeberry/hash";
import { type SerializedStateBackend, StateEntries, type StateKey } from "@typeberry/state-merkleization";
import {
  InMemoryTrie,
  type LeafNode,
  leafComparator,
  NodeType,
  TRIE_NODE_BYTES,
  TrieNode,
  type ValueHash,
} from "@typeberry/trie";
import { getBlake2bTrieHasher } from "@typeberry/trie/hasher.js";
import { assertNever, Result } from "@typeberry/utils";

/** Error during `LeafDb` creation. */
export enum LeafDbError {
  InvalidLeafData = 0,
}

/** Abstraction over access to values that don't fit into leaves. */
export interface ValuesDb {
  /**
   * Retrieve a value under given key.
   *
   * Missing value is considered an irrecoverable error, so the implementations
   * are free to throw if that happens.
   */
  get(key: ValueHash): Uint8Array;
}

/**
 * Reads the collection of leaf nodes and convert them into a Map-like structure
 * that together with some `ValuesDb` may act as `SerializedStateBackend`.
 *
 * Note that reading the actual values may require accessing the original database.
 */
export class LeafDb implements SerializedStateBackend {
  /**
   * Parse given blob containing concatenated leaf nodes into leaf db.
   */
  static fromLeavesBlob(blob: BytesBlob, db: ValuesDb): Result<LeafDb, LeafDbError> {
    if (blob.length % TRIE_NODE_BYTES !== 0) {
      return Result.error(
        LeafDbError.InvalidLeafData,
        () => `${blob.length} is not a multiply of ${TRIE_NODE_BYTES}: ${blob}`,
      );
    }

    const leaves = SortedSet.fromArray(leafComparator, []);
    for (const nodeData of blob.chunks(TRIE_NODE_BYTES)) {
      const node = new TrieNode(nodeData.raw);
      if (node.getNodeType() === NodeType.Branch) {
        return Result.error(LeafDbError.InvalidLeafData, () => `Branch node detected: ${nodeData}`);
      }
      leaves.insert(node.asLeafNode());
    }

    return Result.ok(new LeafDb(leaves, db));
  }

  /** Create leaf db from sorted set of leaves. */
  static fromLeaves(leaves: SortedSet<LeafNode>, db: ValuesDb): LeafDb {
    return new LeafDb(leaves, db);
  }

  /** A mapping between an embedded value or db lookup key. */
  private readonly lookup: TruncatedHashDictionary<StateKey, Lookup>;

  private constructor(
    public readonly leafs: SortedSet<LeafNode>,
    public readonly db: ValuesDb,
  ) {
    this.lookup = TruncatedHashDictionary.fromEntries(
      leafs.array.map((leaf) => {
        const key: StateKey = leaf.getKey().asOpaque();
        const value: Lookup = leaf.hasEmbeddedValue()
          ? {
              kind: LookupKind.EmbeddedValue,
              value: leaf.getValue(),
            }
          : {
              kind: LookupKind.DbKey,
              key: leaf.getValueHash(),
            };
        return [key, value];
      }),
    );
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

  getStateRoot(blake2b: Blake2b): StateRootHash {
    const blake2bTrieHasher = getBlake2bTrieHasher(blake2b);
    return InMemoryTrie.computeStateRoot(blake2bTrieHasher, this.leafs).asOpaque();
  }

  intoStateEntries(): StateEntries {
    const entries: [StateKey, BytesBlob][] = [];
    for (const [key, lookup] of this.lookup.entries()) {
      switch (lookup.kind) {
        case LookupKind.EmbeddedValue:
          entries.push([key.asOpaque(), lookup.value]);
          continue;
        case LookupKind.DbKey:
          entries.push([key.asOpaque(), BytesBlob.blobFrom(this.db.get(lookup.key))]);
          continue;
        default:
          assertNever(lookup);
      }
    }

    return StateEntries.fromEntriesUnsafe(entries);
  }
}

enum LookupKind {
  EmbeddedValue = 0,
  DbKey = 1,
}

type Lookup =
  | {
      kind: LookupKind.EmbeddedValue;
      value: BytesBlob;
    }
  | {
      kind: LookupKind.DbKey;
      key: ValueHash;
    };
