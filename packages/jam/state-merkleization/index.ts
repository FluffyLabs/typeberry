/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

export { convertInMemoryStateToDictionary as serializeInMemoryState, StateEntries } from "./serialize-inmemory";
export { serializeUpdate, TrieAction } from "./serialize-update";
export { merkelizeState } from "./merkleize";
export { SerializedState, Persistence } from "./state-serialized";
export { serialize } from "./serialize";
export { StateKey } from "./keys";
