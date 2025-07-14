import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import { type FromJson, json } from "@typeberry/json-parser";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";

class KeyVal {
  static fromJson: FromJson<KeyVal> = {
    key: fromJson.bytesN(31),
    value: fromJson.bytesBlob,
  };
  key!: Bytes<31>;
  value!: BytesBlob;
}

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.array(KeyVal.fromJson),
  };
  state_root!: StateRootHash;
  keyvals!: StateKeyVals;
}

export type StateKeyVals = KeyVal[];

export function loadState(spec: ChainSpec, keyvals: StateKeyVals) {
  const stateDict = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>(
    keyvals.map(({ key, value }) => [key, value]),
  );
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
  return SerializedState.fromStateEntries(spec, stateEntries);
}
