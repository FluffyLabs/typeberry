import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.map(fromJson.bytesN(31), fromJson.bytesBlob),
  };
  state_root!: StateRootHash;
  keyvals!: KeyVals;
}

export type KeyVals = Map<Bytes<31>, BytesBlob>;

export function loadState(_spec: ChainSpec, _stateData: KeyVals) {
  // TODO: [MaSo] Change KeyVals to SerializeState<LeafDb>
}
