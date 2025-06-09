/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

export { convertInMemoryStateToDictionary as serializeInMemoryState } from "./serialize-inmemory";
export { serializeUpdate } from "./serialize-update";
export { merkelizeState } from "./merkleize";
export { SerializedState } from "./state-serialized";
