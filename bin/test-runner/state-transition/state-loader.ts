import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import { type FromJson, json } from "@typeberry/json-parser";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.map(fromJson.bytesN(31), fromJson.bytesBlob),
  };
  state_root!: StateRootHash;
  keyvals!: StateKeyVals;
}

export type StateKeyVals = Map<Bytes<31>, BytesBlob>;

export function loadState(spec: ChainSpec, keyvals: StateKeyVals) {
  const stateDict = TruncatedHashDictionary.fromEntriesMap<StateKey, BytesBlob>(keyvals.entries());
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
  return SerializedState.fromStateEntries(spec, stateEntries);
}
