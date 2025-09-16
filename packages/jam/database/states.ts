import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type InMemoryState, type ServicesUpdate, type State, UpdateError } from "@typeberry/state";
import { StateEntries } from "@typeberry/state-merkleization";
import { inMemoryStateCodec } from "@typeberry/state-merkleization/in-memory-state-codec.js";
import { assertNever, OK, Result } from "@typeberry/utils";

/** A potential error that occured during state update. */
export enum StateUpdateError {
  /** A conflicting state update has been provided. */
  Conflict = 0,
  /** There was an error committing the changes. */
  Commit = 1,
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
}

export class InMemoryStates implements StatesDb<InMemoryState> {
  private readonly db: HashDictionary<HeaderHash, BytesBlob> = HashDictionary.new();

  constructor(private readonly spec: ChainSpec) {}

  async updateAndSetState(
    headerHash: HeaderHash,
    state: InMemoryState,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const res = state.applyUpdate(update);
    if (res.isOk) {
      return await this.insertState(headerHash, state);
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
    return StateEntries.serializeInMemory(this.spec, state).getRootHash();
  }

  /** Insert a full state into the database. */
  async insertState(headerHash: HeaderHash, state: InMemoryState): Promise<Result<OK, StateUpdateError>> {
    const encoded = Encoder.encodeObject(inMemoryStateCodec, state, this.spec);
    this.db.set(headerHash, encoded);
    return Result.ok(OK);
  }

  getState(headerHash: HeaderHash): InMemoryState | null {
    const encodedState = this.db.get(headerHash);
    if (encodedState === undefined) {
      return null;
    }

    return Decoder.decodeObject(inMemoryStateCodec, encodedState, this.spec);
  }
}
