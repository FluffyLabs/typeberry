import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import type { Blake2b, TruncatedHash } from "@typeberry/hash";
import type { StateKey } from "./keys.js";
import { SerializedState } from "./serialized-state.js";
import { StateEntries } from "./state-entries.js";

export function loadState(spec: ChainSpec, blake2b: Blake2b, entries: Iterable<[StateKey | TruncatedHash, BytesBlob]>) {
  const stateEntries = StateEntries.fromEntriesUnsafe(entries);
  return SerializedState.fromStateEntries(spec, blake2b, stateEntries);
}
