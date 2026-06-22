import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import {
  type InitStatesDb,
  LeafDb,
  type StatesDb,
  StateUpdateError,
  updateLeafs,
  type ValuesDb,
} from "@typeberry/database";
import type { Blake2b } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { ServicesUpdate, State } from "@typeberry/state";
import {
  SerializedState,
  type StateEntries,
  StateEntryUpdateAction,
  serializeStateUpdate,
} from "@typeberry/state-merkleization";
import { type LeafNode, leafComparator, type ValueHash } from "@typeberry/trie";
import { OK, Result } from "@typeberry/utils";
import { FjallRoot, type FjallRootOptions, type Partition, toUint8Array } from "./root.js";

const logger = Logger.new(import.meta.filename, "db");

/**
 * One open fjall keyspace together with its content-addressed `values`
 * partition.
 *
 * Opening the keyspace is the slow part, so the fuzz target opens one session
 * per run and reuses it for every reset (see `HybridSerializedStates.fromSession`).
 * The values partition is immutable - the key is the hash of the value - so it
 * is fine that values pile up across resets, the unreferenced ones just sit
 * there unused.
 */
export class FjallValuesSession {
  private constructor(
    private readonly root: FjallRoot,
    /** Shared content-addressed values partition, reused across resets. */
    readonly values: Partition,
  ) {}

  /** Open (or create) the keyspace at `dbPath` and its `values` partition. */
  static async open(dbPath: string, options: FjallRootOptions = {}): Promise<FjallValuesSession> {
    const root = await FjallRoot.open(dbPath, options);
    const values = await root.partition("values");
    return new FjallValuesSession(root, values);
  }

  /** Flush the journal to disk (a no-op for ephemeral keyspaces). */
  async persist(): Promise<void> {
    await this.root.persist();
  }

  /** Size of the keyspace directory on disk, in bytes. */
  sizeInBytes(): number | null {
    return this.root.sizeInBytes();
  }

  /** Release the keyspace handle (skips the sync-all fsync when ephemeral). */
  async close(): Promise<void> {
    await this.root.close();
  }
}

/**
 * Hybrid serialized-states db (fjall variant).
 *
 * States (leafs) are kept in memory, only the large values go to fjall on disk.
 * Reads hit fjall directly, which keeps its own bounded block cache. Meant for
 * long fuzzing, used together with pruning so the heap stays bounded.
 *
 * Construction is async, and value writes are flushed explicitly, because fjall
 * has no transaction primitive.
 */
export class HybridSerializedStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  static async new({
    spec,
    blake2b,
    dbPath,
    ephemeral,
    cacheSizeBytes,
  }: {
    spec: ChainSpec;
    blake2b: Blake2b;
    dbPath: string;
    ephemeral?: boolean;
    cacheSizeBytes?: number;
  }): Promise<HybridSerializedStates> {
    const session = await FjallValuesSession.open(dbPath, { ephemeral, cacheSizeBytes });
    // This instance owns the session it just opened, so its `close()` closes it.
    return new HybridSerializedStates(spec, blake2b, session, true);
  }

  /**
   * Wrap an already-open `FjallValuesSession` and reuse its keyspace.
   *
   * The new instance starts with its own empty in-memory leaf sets but shares
   * the values partition on disk. Its `close()` does not close the session, the
   * session owner closes it once. The fuzz target uses this to keep one keyspace
   * across resets and only rebuild the in-memory state for each vector.
   */
  static fromSession(spec: ChainSpec, blake2b: Blake2b, session: FjallValuesSession): HybridSerializedStates {
    return new HybridSerializedStates(spec, blake2b, session, false);
  }

  private readonly inMemStates: HashDictionary<HeaderHash, SortedSet<LeafNode>> = HashDictionary.new();
  // A single shared values accessor reused by every `LeafDb` we hand out.
  private readonly valuesDb: ValuesDb;
  /** Shared content-addressed values partition (owned by `session`). */
  private readonly values: Partition;

  private constructor(
    private readonly spec: ChainSpec,
    private readonly blake2b: Blake2b,
    private readonly session: FjallValuesSession,
    /** Whether `close()` should close the underlying session. */
    private readonly ownsSession: boolean,
  ) {
    this.values = session.values;
    this.valuesDb = { get: (key: ValueHash) => this.readValue(key) };
  }

  async insertInitialState(headerHash: HeaderHash, entries: StateEntries): Promise<Result<OK, StateUpdateError>> {
    const { values, leafs } = updateLeafs(
      SortedSet.fromArray(leafComparator, []),
      this.blake2b,
      Array.from(entries, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );
    const res = await this.writeValues(values);
    if (res.isError) {
      return res;
    }
    this.inMemStates.set(headerHash, leafs);
    return Result.ok(OK);
  }

  async updateAndSetState(
    header: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const updatedValues = serializeStateUpdate(this.spec, this.blake2b, update);
    // Clone the leaf set before mutating: the previous state keeps using its own.
    const newLeafs = SortedSet.fromSortedArray(leafComparator, state.backend.leafs.array);
    const { values, leafs } = updateLeafs(newLeafs, this.blake2b, updatedValues);
    const res = await this.writeValues(values);
    if (res.isError) {
      // Leave the caller's state untouched: its new leaves would reference
      // values that never reached disk.
      return res;
    }
    // Re-create the lookup with the shared values accessor only once the new
    // values are durably written.
    state.updateBackend(LeafDb.fromLeaves(leafs, this.valuesDb));
    this.inMemStates.set(header, leafs);
    return Result.ok(OK);
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(this.blake2b);
  }

  getState(header: HeaderHash): SerializedState<LeafDb> | null {
    const leafs = this.inMemStates.get(header);
    if (leafs === undefined) {
      return null;
    }
    const leafDb = LeafDb.fromLeaves(leafs, this.valuesDb);
    return SerializedState.new(this.spec, this.blake2b, leafDb);
  }

  markUnused(header: HeaderHash): void {
    // We only remove the state from memory - values are not pruned at all,
    // but since they are stored on disk we should be safe.
    this.inMemStates.delete(header);
  }

  diskSizeInBytes(): number | null {
    return this.session.sizeInBytes();
  }

  async close() {
    // Instances backed by a shared session (fuzz reset reuse) keep the keyspace
    // open for the next reset. The session owner closes it once.
    if (this.ownsSession) {
      await this.session.close();
    }
  }

  /** Write new large values to fjall in a single batch, then flush. */
  private async writeValues(values: [ValueHash, BytesBlob][]): Promise<Result<OK, StateUpdateError>> {
    if (values.length === 0) {
      return Result.ok(OK);
    }
    try {
      const entries = values.map(([hash, val]) => ({ key: hash.raw, value: val.raw }));
      await this.values.insertBatch(entries);
      await this.session.persist();
    } catch (e) {
      logger.error`${e}`;
      return Result.error(StateUpdateError.Commit, () => `Failed to commit values: ${e}`);
    }
    return Result.ok(OK);
  }

  /** Read a value from fjall. */
  private readValue(key: ValueHash): Uint8Array {
    const val = toUint8Array(this.values.get(key.raw));
    if (val === null) {
      throw new Error(`Missing value at key: ${key}`);
    }
    return val;
  }
}
