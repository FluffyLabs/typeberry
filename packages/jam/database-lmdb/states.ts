import type { StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { StatesDb } from "@typeberry/database";
import type { State } from "@typeberry/state";
import { stateDumpCodec } from "@typeberry/state-merkleization/dump";
import type { LmdbRoot, SubDb } from "./root";

export class LmdbStates implements StatesDb {
  private readonly states: SubDb;

  constructor(
    private readonly spec: ChainSpec,
    private readonly root: LmdbRoot,
  ) {
    this.states = this.root.subDb("states");
  }

  async insertFullState(root: StateRootHash, state: State): Promise<void> {
    const encoded = Encoder.encodeObject(stateDumpCodec, state, this.spec);
    this.states.put(root.raw, encoded.raw);
  }

  getFullState(root: StateRootHash): State | null {
    const encodedState = this.states.get(root.raw);
    if (encodedState === undefined) {
      return null;
    }

    return Decoder.decodeObject(stateDumpCodec, encodedState, this.spec);
  }
}
