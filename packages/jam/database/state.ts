import type { StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { OpaqueHash } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { stateDumpCodec } from "@typeberry/state-merkleization/dump";
import type { Opaque } from "@typeberry/utils";

/**
 * Temporary and simple state database.
 *
 * We store the entire state with full keys under it's state root hash.
 *
 * Note that this is sub-optimal for some reasons:
 * 1. Answering CE-129 queries requires us storing all trie nodes.
 * 2. We can't load `SerializedState` (since we don't have full keys).
 * 3. We store a lot of duplicated data.
 *
 * but also nice (we have full key data - fast retrieval) and simple (easy access
 * to the state fields, loading state, etc), but might not be sustainable.
 *
 * A slightly better option would be to store only changes to the state instead of full
 * one.
 *
 * Some other options that we have:
 * 1. Store `SerializedState` and compute the merkle trie on-demand.
 *    1. If our storage is somehow based on the merkle trie keys we could answer
 *       ce-129 given the key. (nomt approach)
 *    2. If our storage is more naive we will not know what exact state neededs
 *       to be merkelized when a random trie node is requested.
 * 2. Store all trie nodes and do some pruning of old ones - basically an archive node.
 *
 * In case of any of these options, when accessing state we will need to compute
 * the keys before retrieving the data (which is slower).
 *
 */
export class StateDb {
  constructor(
    private readonly spec: ChainSpec,
    private readonly db: KeyValueDatabase,
  ) {}

  async setFullState(root: StateRootHash, state: State) {
    const encoded = Encoder.encodeObject(stateDumpCodec, state, this.spec);
    const tx = this.db.newTransaction();
    tx.insert(root.asOpaque(), encoded);
    await this.db.commit(tx);
  }

  getFullState(root: StateRootHash): State | null {
    const encodedState = this.db.get(root.asOpaque());
    if (encodedState === null) {
      return null;
    }

    return Decoder.decodeObject(stateDumpCodec, encodedState, this.spec);
  }
}

export type DbKey = Opaque<OpaqueHash, "db key">;

/** Basic abstraction over key-value database. */
export interface KeyValueDatabase<Tx extends Transaction = Transaction> {
  /** Retrieve a key from the database. */
  get(key: DbKey): BytesBlob | null;

  /** Check if the key is present in the database. */
  has(key: DbKey): boolean;

  /** Create new transaction to alter the database. */
  newTransaction(): Tx;

  /** Commit the changes from a transaction back to the database. */
  commit(tx: Tx): Promise<void>;
}

/** Database-altering transaction. */
export interface Transaction {
  /** Insert/Overwrite key in the database. */
  insert(key: DbKey, value: BytesBlob): void;

  /** Remove a key from the database. */
  remove(key: DbKey): void;
}

export class InMemoryKvdb implements KeyValueDatabase<InMemoryTransaction> {
  private readonly db: HashDictionary<DbKey, BytesBlob> = HashDictionary.new();

  get(key: DbKey): BytesBlob | null {
    const value = this.db.get(key);
    return value ?? null;
  }

  has(key: DbKey): boolean {
    const x = this.get(key);
    return x !== null;
  }

  newTransaction(): InMemoryTransaction {
    return new InMemoryTransaction();
  }

  commit(tx: InMemoryTransaction): Promise<void> {
    for (const [key, value] of tx.writes) {
      if (value !== null) {
        this.db.set(key, value);
      } else {
        this.db.delete(key);
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryTransaction implements Transaction {
  readonly writes: [DbKey, BytesBlob | null][] = [];

  insert(key: DbKey, value: BytesBlob): void {
    this.writes.push([key, value]);
  }

  remove(key: DbKey): void {
    this.writes.push([key, null]);
  }
}
