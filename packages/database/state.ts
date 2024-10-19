import { type CodeHash, type ServiceId, WithHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type HashableBlob, type OpaqueHash, hashString } from "@typeberry/hash";
import { InMemoryTrie, type StateKey, type TrieHash } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/blake2b.node";
import { WriteableNodesDb } from "@typeberry/trie/nodesDb";

export class StateDb {
  constructor(private readonly db: InMemoryKvdb) {}

  stateAt(root: TrieHash): State | null {
    const hasRootNode = this.db.has(root as OpaqueHash as StateKey);
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
    private readonly root: TrieHash,
  ) {}

  getServiceCode(serviceId: ServiceId): WithHash<CodeHash, BytesBlob> | null {
    const key = hashString(`serviceCodeHash:${serviceId}`);
    const blob = this.db.get(key as StateKey);
    if (!blob) {
      return null;
    }
    const hash = blob.buffer.subarray(0, HASH_SIZE);
    const code = blob.buffer.subarray(HASH_SIZE);

    return new WithHash(Bytes.fromBlob(hash, HASH_SIZE) as CodeHash, BytesBlob.fromBlob(code));
  }
}

/** Basic abstraction over key-value database. */
export interface KeyValueDatabase<Tx extends Transaction> {
  /** Retrieve a key from the database. */
  get(key: StateKey): BytesBlob | null;

  /** Check if the key is present in the database. */
  has(key: StateKey): boolean;

  /** Get database commitment (merkle root hash). */
  getRoot(): TrieHash;

  /** Create new transaction to alter the database. */
  newTransaction(): Tx;

  /** Commit the changes from a transaction back to the database and get the root. */
  commit(tx: Tx): Promise<TrieHash>;
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
  private readonly flat: HashDictionary<StateKey, HashableBlob>;
  private readonly trie: InMemoryTrie;

  constructor() {
    this.db = new WriteableNodesDb(blake2bTrieHasher);
    this.flat = new HashDictionary();
    this.trie = new InMemoryTrie(this.db);
  }

  get(key: StateKey): BytesBlob | null {
    const value = this.flat.get(key);
    return value?.blob ?? null;
  }

  has(key: StateKey): boolean {
    const x = this.get(key);
    return x !== null;
  }

  getRoot(): TrieHash {
    return this.trie.getRoot();
  }

  newTransaction(): InMemoryTransaction {
    return new InMemoryTransaction();
  }

  commit(tx: InMemoryTransaction): Promise<TrieHash> {
    for (const [key, value] of tx.writes) {
      if (value) {
        this.trie.set(key, value.blob, value.getHash());
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
  readonly writes: [StateKey, HashableBlob<TrieHash> | null][] = [];

  insert(key: StateKey, value: HashableBlob<TrieHash>): void {
    this.writes.push([key, value]);
  }

  remove(key: StateKey): void {
    this.writes.push([key, null]);
  }
}
