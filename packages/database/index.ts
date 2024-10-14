import type { BytesBlob } from "@typeberry/bytes";
import type { HashableBlob } from "@typeberry/hash";
import { InMemoryTrie, type StateKey, type TrieHash } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/blake2b.node";
import { WriteableNodesDb } from "@typeberry/trie/nodesDb";

/** Basic abstraction over key-value database. */
export interface KeyValueDatabase<Tx extends Transaction> {
  /** Retrieve a key from the database. */
  get(key: StateKey): Promise<BytesBlob | null>;

  /** Check if the key is present in the database. */
  has(key: StateKey): Promise<boolean>;

  /** Get database commitment (merkle root hash). */
  getRoot(): Promise<TrieHash>;

  /** Create new transaction to alter the database. */
  newTransaction(): Tx;

  /** Commit the changes from a transaction back to the database. */
  commit(tx: Tx): Promise<void>;
}

/** Database-altering transaction. */
export interface Transaction {
  /** Insert/Overwrite key in the database. */
  insert(key: StateKey, value: HashableBlob<TrieHash>): void;

  /** Remove a key from the database. */
  remove(key: StateKey): void;
}

export class InMemoryKvdb implements KeyValueDatabase<InMemoryTransaction> {
  private readonly db: WriteableNodesDb;
  private readonly flat: Map<string, HashableBlob>;
  private readonly trie: InMemoryTrie;

  constructor() {
    this.db = new WriteableNodesDb(blake2bTrieHasher);
    this.flat = new Map();
    this.trie = new InMemoryTrie(this.db);
  }

  get(key: StateKey): Promise<BytesBlob | null> {
    const value = this.flat.get(key.toString());
    return Promise.resolve(value?.blob ?? null);
  }

  async has(key: StateKey): Promise<boolean> {
    const x = await this.get(key);
    return x !== null;
  }

  getRoot(): Promise<TrieHash> {
    return Promise.resolve(this.trie.getRoot());
  }

  newTransaction(): InMemoryTransaction {
    return new InMemoryTransaction();
  }

  commit(tx: InMemoryTransaction): Promise<void> {
    for (const [key, value] of tx.writes) {
      if (value) {
        this.trie.set(key, value.blob, value.getHash());
        this.flat.set(key.toString(), value);
      } else {
        this.trie.remove(key);
        this.flat.delete(key.toString());
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryTransaction implements Transaction {
  readonly writes: [StateKey, HashableBlob<TrieHash> | null][] = [];

  insert(key: StateKey, value: HashableBlob<TrieHash>): void {
    this.writes.push([key, value]);
  }

  remove(key: StateKey): void {
    this.writes.push([key, null]);
  }
}
