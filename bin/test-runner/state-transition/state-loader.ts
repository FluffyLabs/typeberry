import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import { type FromJson, json } from "@typeberry/json-parser";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { TRUNCATED_KEY_BYTES } from "@typeberry/trie";

export class StateKeyVal {
  static fromJson: FromJson<StateKeyVal> = {
    key: fromJson.bytesN(TRUNCATED_KEY_BYTES),
    value: fromJson.bytesBlob,
  };
  key!: Bytes<TRUNCATED_KEY_BYTES>;
  value!: BytesBlob;
}

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.array(StateKeyVal.fromJson),
  };
  state_root!: StateRootHash;
  keyvals!: StateKeyVal[];
}

export function loadState(spec: ChainSpec, keyvals: StateKeyVal[]) {
  const stateDict = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>(keyvals.map((x) => [x.key.asOpaque(), x.value]));
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
  return SerializedState.fromStateEntries(spec, stateEntries);
}
