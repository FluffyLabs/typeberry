import type { ChainSpec } from "@typeberry/config";
import type { Blake2b } from "@typeberry/hash";
import { loadState as loadSerializedState } from "@typeberry/state-merkleization";
import type { StateKeyVal } from "@typeberry/state-vectors";

export function loadState(spec: ChainSpec, blake2b: Blake2b, keyvals: StateKeyVal[]) {
  return loadSerializedState(
    spec,
    blake2b,
    keyvals.map((x) => [x.key, x.value]),
  );
}
