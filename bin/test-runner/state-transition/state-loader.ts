import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { loadState as loadSerializedState } from "@typeberry/state-merkleization";

export class StateKeyVal {
  static fromJson: FromJson<StateKeyVal> = {
    key: fromJson.bytesN(TRUNCATED_HASH_SIZE),
    value: fromJson.bytesBlob,
  };
  key!: TruncatedHash;
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
  return loadSerializedState(
    spec,
    keyvals.map((x) => [x.key, x.value]),
  );
}
