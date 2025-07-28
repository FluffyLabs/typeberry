import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { loadState as loadSerializedState } from "@typeberry/state-merkleization";

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.map(fromJson.bytesN(TRUNCATED_HASH_SIZE), fromJson.bytesBlob),
  };
  state_root!: StateRootHash;
  keyvals!: StateKeyVals;
}

export type StateKeyVals = Map<TruncatedHash, BytesBlob>;

export function loadState(spec: ChainSpec, keyvals: StateKeyVals) {
  return loadSerializedState(spec, keyvals.entries());
}
