import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { InMemoryState, type ServicesUpdate, type State, UpdateError } from "@typeberry/state";
import { StateEntries } from "@typeberry/state-merkleization";
import { assertNever, OK, Result } from "@typeberry/utils";

/** A potential error that occured during state update. */
export enum StateUpdateError {
  /** A conflicting state update has been provided. */
  Conflict = 0,
  /** There was an error committing the changes. */
  Commit = 1,
}

/** Interface to initialize states db. Typically used in conjunction with `StatesDb`. */
export interface InitStatesDb<T = State> {
  /** Insert a pre-defined initial state directly into the database. */
  insertInitialState(headerHash: HeaderHash, initialState: T): Promise<Result<OK, StateUpdateError>>;
}

/**
 * Interface for accessing states stored in the database.
 *
 * NOTE that the design of this interface is heavily influenced
 * by the LMDB implementation, so that we can implement it efficiently.
 *
 * See the documentation there for more detailed reasoning.
 */
export interface StatesDb<T extends State = State> {
  /** Compute a state root for given state. */
  getStateRoot(state: T): Promise<StateRootHash>;

  /**
   * Apply & commit a state update.
   *
   * NOTE: for efficiency, the implementation MAY alter given `state` object.
   */
  updateAndSetState(
    header: HeaderHash,
    state: T,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>>;

  /** Retrieve posterior state of given header. */
  getState(header: HeaderHash): T | null;

  /** Close the database and free resources. */
  close(): Promise<void>;
}

export class InMemoryStates implements StatesDb<InMemoryState> {
  private readonly db: HashDictionary<HeaderHash, InMemoryState> = HashDictionary.new();
  private readonly blake2b: Promise<Blake2b>;

  constructor(private readonly spec: ChainSpec) {
    this.blake2b = Blake2b.createHasher();
  }

  async updateAndSetState(
    headerHash: HeaderHash,
    state: InMemoryState,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const res = state.applyUpdate(update);
    if (res.isOk) {
      return await this.insertInitialState(headerHash, state);
    }

    switch (res.error) {
      case UpdateError.DuplicateService:
      case UpdateError.NoService:
      case UpdateError.PreimageExists:
        return Result.error(StateUpdateError.Conflict, res.details);
      default:
        assertNever(res.error);
    }
  }

  async getStateRoot(state: InMemoryState): Promise<StateRootHash> {
    const blake2b = await this.blake2b;
    return StateEntries.serializeInMemory(this.spec, blake2b, state).getRootHash(blake2b);
  }

  /** Insert a full state into the database. */
  async insertInitialState(headerHash: HeaderHash, state: InMemoryState): Promise<Result<OK, StateUpdateError>> {
    const copy = InMemoryState.copyFrom(this.spec, state, state.intoServicesData());
    this.db.set(headerHash, copy);
    return Result.ok(OK);
  }

  getState(headerHash: HeaderHash): InMemoryState | null {
    const state = this.db.get(headerHash);
    if (state === undefined) {
      return null;
    }

    return InMemoryState.copyFrom(this.spec, state, state.intoServicesData());
  }

  async close() {}
}
