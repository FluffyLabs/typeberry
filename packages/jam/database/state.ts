import type { CodeHash, ServiceId, StateRootHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import { InMemoryTrie, type StateKey, type TrieHash } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher";
import { WriteableNodesDb } from "@typeberry/trie/nodesDb";

export class StateDb {
  constructor(private readonly db: InMemoryKvdb) {}

  stateAt(root: StateRootHash): State | null {
    const hasRootNode = this.db.has(root.asOpaque());
    // we don't know about that trie.
    if (!hasRootNode) {
      return null;
    }
    return new State(this.db, root);
  }
}

export class State {
  constructor(
    private readonly db: InMemoryKvdb,
    public readonly root: StateRootHash,
  ) {}

  getServiceCode(serviceId: ServiceId): WithHash<CodeHash, BytesBlob> | null {
    const key = blake2b.hashString(`serviceCodeHash:${serviceId}`);
    // TODO [ToDr] here we need to make sure that the key is part of the root!
    const blob = this.db.get(key.asOpaque());
    if (!blob) {
      return null;
    }
    const hash = blob.raw.subarray(0, HASH_SIZE);
    const code = blob.raw.subarray(HASH_SIZE);

    return new WithHash(Bytes.fromBlob(hash, HASH_SIZE).asOpaque(), BytesBlob.blobFrom(code));
  }
}

/** Basic abstraction over key-value database. */
export interface KeyValueDatabase<Tx extends Transaction> {
  /** Retrieve a key from the database. */
  get(key: StateKey): BytesBlob | null;

  /** Check if the key is present in the database. */
  has(key: StateKey): boolean;

  /** Get database commitment (merkle root hash). */
  getRoot(): StateRootHash;

  /** Create new transaction to alter the database. */
  newTransaction(): Tx;

  /** Commit the changes from a transaction back to the database and get the root. */
  commit(tx: Tx): Promise<StateRootHash>;
}

/** Database-altering transaction. */
export interface Transaction {
  /** Insert/Overwrite key in the database. */
  insert(key: StateKey, value: WithHash<TrieHash, BytesBlob>): void;

  /** Remove a key from the database. */
  remove(key: StateKey): void;
}

export class InMemoryKvdb implements KeyValueDatabase<InMemoryTransaction> {
  private readonly db: WriteableNodesDb;
  private readonly flat: HashDictionary<StateKey, WithHash<TrieHash, BytesBlob>>;
  private readonly trie: InMemoryTrie;

  constructor() {
    this.db = new WriteableNodesDb(blake2bTrieHasher);
    this.flat = new HashDictionary();
    this.trie = new InMemoryTrie(this.db);
  }

  get(key: StateKey): BytesBlob | null {
    const value = this.flat.get(key);
    return value?.data ?? null;
  }

  has(key: StateKey): boolean {
    const x = this.get(key);
    return x !== null;
  }

  getRoot(): StateRootHash {
    return this.trie.getRootHash().asOpaque();
  }

  newTransaction(): InMemoryTransaction {
    return new InMemoryTransaction();
  }

  commit(tx: InMemoryTransaction): Promise<StateRootHash> {
    for (const [key, value] of tx.writes) {
      if (value) {
        this.trie.set(key, value.data, value.hash);
        this.flat.set(key, value);
      } else {
        this.trie.remove(key);
        this.flat.delete(key);
      }
    }
    return Promise.resolve(this.getRoot());
  }
}

export class InMemoryTransaction implements Transaction {
  readonly writes: [StateKey, WithHash<TrieHash, BytesBlob> | null][] = [];

  insert(key: StateKey, value: WithHash<TrieHash, BytesBlob>): void {
    this.writes.push([key, value]);
  }

  remove(key: StateKey): void {
    this.writes.push([key, null]);
  }
}
