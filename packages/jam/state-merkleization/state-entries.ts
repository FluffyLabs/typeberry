import type { StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { SortedSet, TruncatedHashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type Blake2b, HASH_SIZE, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import type { InMemoryState } from "@typeberry/state";
import { InMemoryTrie, type LeafNode, leafComparator } from "@typeberry/trie";
import { getBlake2bTrieHasher } from "@typeberry/trie/hasher.js";
import { assertNever, TEST_COMPARE_USING } from "@typeberry/utils";
import type { StateKey } from "./keys.js";
import { type StateCodec, serialize } from "./serialize.js";
import { type StateEntryUpdate, StateEntryUpdateAction } from "./serialize-state-update.js";

const TYPICAL_STATE_ITEMS = 50;
const TYPICAL_STATE_ITEM_LEN = 50;

const stateEntriesSequenceCodec = codec.sequenceVarLen(codec.pair(codec.bytes(TRUNCATED_HASH_SIZE), codec.blob));
/**
 * Full, in-memory state represented as serialized entries dictionary.
 *
 * State entries may be wrapped into `SerializedState` to access the contained values.
 */
export class StateEntries {
  static Codec = codec.custom<StateEntries>(
    {
      name: "StateEntries",
      sizeHint: {
        isExact: false,
        bytes: TYPICAL_STATE_ITEMS * (HASH_SIZE + TYPICAL_STATE_ITEM_LEN),
      },
    },
    (e, v) => stateEntriesSequenceCodec.encode(e, Array.from(v.entries)),
    (d) => StateEntries.fromEntriesUnsafe(stateEntriesSequenceCodec.decode(d)),
    (s) => stateEntriesSequenceCodec.skip(s),
  );

  /** Turn in-memory state into it's serialized form. */
  static serializeInMemory(spec: ChainSpec, blake2b: Blake2b, state: InMemoryState) {
    return new StateEntries(convertInMemoryStateToDictionary(spec, blake2b, state));
  }

  /**
   * Wrap a collection of truncated state entries and treat it as state.
   *
   * NOTE: There is no verification happening, so the state may be
   * incomplete. Use only if you are sure this is all the entries needed.
   */
  static fromDictionaryUnsafe(data: TruncatedHashDictionary<StateKey, BytesBlob>): StateEntries {
    return new StateEntries(data);
  }

  /**
   * Create a new serialized state from a collection of existing entries.
   *
   * NOTE: There is no verification happening, so the state may be
   * incomplete. Use only if you are sure this is all the entries needed.
   */
  static fromEntriesUnsafe(
    entries: Iterable<[StateKey | TruncatedHash, BytesBlob] | readonly [StateKey | TruncatedHash, BytesBlob]>,
  ) {
    return new StateEntries(TruncatedHashDictionary.fromEntries(entries));
  }

  private constructor(private readonly entries: TruncatedHashDictionary<StateKey, BytesBlob>) {}

  /** When comparing, we can safely ignore `trieCache` and just use entries. */
  [TEST_COMPARE_USING]() {
    return Object.fromEntries(this.entries);
  }

  /** Dump state entries */
  getEntries() {
    return Array.from(this.entries.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }

  /** Dump state entries to JSON string (format compatible with stf vectors). */
  toString() {
    return JSON.stringify(this.getEntries(), null, 2);
  }

  [Symbol.iterator]() {
    return this.entries[Symbol.iterator]();
  }

  /** Retrieve value of some serialized key (if present). */
  get(key: StateKey): BytesBlob | null {
    return this.entries.get(key) ?? null;
  }

  /** Modify underlying entries dictionary with given update. */
  applyUpdate(stateEntriesUpdate: Iterable<StateEntryUpdate>) {
    for (const [action, key, value] of stateEntriesUpdate) {
      if (action === StateEntryUpdateAction.Insert) {
        this.entries.set(key, value);
      } else if (action === StateEntryUpdateAction.Remove) {
        this.entries.delete(key);
      } else {
        assertNever(action);
      }
    }
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/391600391600?v=0.6.4 */
  getRootHash(blake2b: Blake2b): StateRootHash {
    const blake2bTrieHasher = getBlake2bTrieHasher(blake2b);
    const leaves: SortedSet<LeafNode> = SortedSet.fromArray(leafComparator);
    for (const [key, value] of this) {
      leaves.insert(InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), value));
    }

    return InMemoryTrie.computeStateRoot(blake2bTrieHasher, leaves).asOpaque();
  }
}

/** https://graypaper.fluffylabs.dev/#/68eaa1f/38a50038a500?v=0.6.4 */
function convertInMemoryStateToDictionary(
  spec: ChainSpec,
  blake2b: Blake2b,
  state: InMemoryState,
): TruncatedHashDictionary<StateKey, BytesBlob> {
  const serialized = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>([]);
  function doSerialize<T>(codec: StateCodec<T>) {
    serialized.set(codec.key, Encoder.encodeObject(codec.Codec, codec.extract(state), spec));
  }

  doSerialize(serialize.authPools); // C(1)
  doSerialize(serialize.authQueues); // C(2)
  doSerialize(serialize.recentBlocks); // C(3)
  doSerialize(serialize.safrole); // C(4)
  doSerialize(serialize.disputesRecords); // C(5)
  doSerialize(serialize.entropy); // C(6)
  doSerialize(serialize.designatedValidators); // C(7)
  doSerialize(serialize.currentValidators); // C(8)
  doSerialize(serialize.previousValidators); // C(9)
  doSerialize(serialize.availabilityAssignment); // C(10)
  doSerialize(serialize.timeslot); // C(11)
  doSerialize(serialize.privilegedServices); // C(12)
  doSerialize(serialize.statistics); // C(13)
  doSerialize(serialize.accumulationQueue); // C(14)
  doSerialize(serialize.recentlyAccumulated); // C(15)
  doSerialize(serialize.accumulationOutputLog); // C(16)

  // services
  for (const [serviceId, service] of state.services.entries()) {
    // data
    const { key, Codec } = serialize.serviceData(serviceId);
    serialized.set(key, Encoder.encodeObject(Codec, service.getInfo()));

    // preimages
    for (const preimage of service.data.preimages.values()) {
      const { key, Codec } = serialize.servicePreimages(blake2b, serviceId, preimage.hash);
      serialized.set(key, Encoder.encodeObject(Codec, preimage.blob));
    }

    // storage
    for (const storage of service.data.storage.values()) {
      const { key, Codec } = serialize.serviceStorage(blake2b, serviceId, storage.key);
      serialized.set(key, Encoder.encodeObject(Codec, storage.value));
    }

    // lookup history
    for (const lookupHistoryList of service.data.lookupHistory.values()) {
      for (const lookupHistory of lookupHistoryList) {
        const { key, Codec } = serialize.serviceLookupHistory(
          blake2b,
          serviceId,
          lookupHistory.hash,
          lookupHistory.length,
        );
        serialized.set(key, Encoder.encodeObject(Codec, lookupHistory.slots.slice()));
      }
    }
  }

  return serialized;
}
