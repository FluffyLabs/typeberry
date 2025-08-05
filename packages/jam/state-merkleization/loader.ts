import type { BytesBlob } from "@typeberry/bytes";
import { TruncatedHashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { TruncatedHash } from "@typeberry/hash";
import type { StateKey } from "./keys.js";
import { SerializedState } from "./serialized-state.js";
import { StateEntries } from "./state-entries.js";

export function loadState(spec: ChainSpec, entries: Iterable<[StateKey | TruncatedHash, BytesBlob]>) {
  const stateDict = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>(entries);
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
  return SerializedState.fromStateEntries(spec, stateEntries);
}
