/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import type { State } from "@typeberry/state";
import type { StateKey } from "./keys";

// TODO [ToDr]
// Define state mapping as an enum.
// Compare performance between:
// 1. generator
// 2. returning an array / Uint8Array
// 3. calling "writeInto" function.

export type SerializedState = HashDictionary<StateKey, BytesBlob>;

export function serializeState(state: State): SerializedState {
  const map = new HashDictionary<StateKey, BytesBlob>();
  return map;
}
