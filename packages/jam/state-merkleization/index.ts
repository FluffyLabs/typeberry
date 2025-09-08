/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 *
 * State representations:
 *
 * We maintain two "views" of our chain state:
 *
 * - **InMemoryState**
 *   - Full, canonical state held entirely in memory.
 *   - Complete info on every field, plus lists of services, modules, etc.
 *
 * - **SerializedState<T>**
 *   - Generic wrapper around a serialized snapshot of the state.
 *   - Only the bytes (and minimal metadata) are held up front.
 *   - Three instantiations:
 *     - `SerializedState<Persistence>`: Pure "black-box" serialized blob
 *        (incomplete in-memory view).
 *     - `SerializedState<LeafDb>`: Disk-backed trie storage-leaf nodes live on
 *        disk and load on demand; cheap to update (no data duplication) and re-compute
 *        the `stateRoot`. Used in LMDB.
 *     - `SerializedState<StateEntries>`: serialized state represented as a simple in-memory
 *        hashmap of `key -> value` entries.
 */
export * from "./serialize-state-update.js";
export * from "./serialized-state.js";
export * from "./state-entries.js";
export * from "./serialize.js";
export * from "./keys.js";
export * from "./binary-merkleization.js";
export * from "./loader.js";
