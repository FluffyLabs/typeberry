import type { StateRootHash } from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { TruncatedHashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { InMemoryState } from "@typeberry/state";
import { type BytesBlob, InMemoryTrie } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher.js";
import { TEST_COMPARE_USING, assertNever } from "@typeberry/utils";
import type { StateKey } from "./keys.js";
import { type StateEntryUpdate, StateEntryUpdateAction } from "./serialize-state-update.js";
import { type StateCodec, serialize } from "./serialize.js";

/** Full (i.e. 32 bytes; non-truncated) state entries. */
export type FullEntries = {
  full: true;
  data: HashDictionary<StateKey, BytesBlob>;
};

/** Truncated (i.e. 31 bytes extended to 32 bytes) state entries. */
export type TruncatedEntries = {
  full: false;
  data: TruncatedHashDictionary<StateKey, BytesBlob>;
};

/**
 * Full, in-memory state represented as serialized entries dictionary.
 *
 * State entries may be wrapped into `SerializedState` to access the contained values.
 */
export class StateEntries<TEntries extends FullEntries | TruncatedEntries = FullEntries | TruncatedEntries> {
  /** Turn in-memory state into it's serialized form. */
  static serializeInMemory(spec: ChainSpec, state: InMemoryState): StateEntries<FullEntries> {
    return new StateEntries({
      full: true,
      data: convertInMemoryStateToDictionary(spec, state),
    });
  }

  /**
   * Wrap a collection of state entries and treat it as state.
   *
   * NOTE: There is no verification happening, so the state may be
   * incomplete. Use only if you are sure this is all the entries needed.
   */
  static fromDictionaryUnsafe(data: FullEntries["data"]): StateEntries<FullEntries> {
    return new StateEntries({
      full: true,
      data,
    });
  }

  /**
   * Wrap a collection of truncated state entries and treat it as state.
   *
   * NOTE: There is no verification happening, so the state may be
   * incomplete. Use only if you are sure this is all the entries needed.
   */
  static fromTruncatedDictionaryUnsafe(data: TruncatedEntries["data"]): StateEntries<TruncatedEntries> {
    return new StateEntries({
      full: false,
      data,
    });
  }

  private trieCache: InMemoryTrie | null = null;

  private constructor(public readonly entries: TEntries) {}

  /** When comparing, we can safely ignore `trieCache` and just use entries. */
  [TEST_COMPARE_USING]() {
    return this.entries.data;
  }

  /** Construct the trie from given set of state entries. */
  public getTrie(): InMemoryTrie {
    if (this.trieCache === null) {
      const trie = InMemoryTrie.empty(blake2bTrieHasher);
      for (const [key, value] of this.entries.data) {
        trie.set(key.asOpaque(), value);
      }
      this.trieCache = trie;
    }
    return this.trieCache;
  }

  /** Retrieve value of some serialized key (if present). */
  get(key: StateKey): BytesBlob | null {
    return this.entries.data.get(key) ?? null;
  }

  /** Modify underlying entries dictionary with given update. */
  applyUpdate(stateEntriesUpdate: Iterable<StateEntryUpdate>) {
    // NOTE since we are altering the structure, we need to reset the cache.
    this.trieCache = null;
    for (const [action, key, value] of stateEntriesUpdate) {
      if (action === StateEntryUpdateAction.Insert) {
        this.entries.data.set(key, value);
      } else if (action === StateEntryUpdateAction.Remove) {
        this.entries.data.delete(key);
      } else {
        assertNever(action);
      }
    }
  }

  /** https://graypaper.fluffylabs.dev/#/68eaa1f/391600391600?v=0.6.4 */
  getRootHash(): StateRootHash {
    // TODO [ToDr] it should be possible to do this more efficiently
    // by converting the state entries into leaf nodes and constructing
    // the trie from the trie nodes.
    return this.getTrie().getRootHash().asOpaque();
  }
}

/** https://graypaper.fluffylabs.dev/#/68eaa1f/38a50038a500?v=0.6.4 */
function convertInMemoryStateToDictionary(spec: ChainSpec, state: InMemoryState): HashDictionary<StateKey, BytesBlob> {
  const serialized = HashDictionary.new<StateKey, BytesBlob>();
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

  // services
  for (const [serviceId, service] of state.services.entries()) {
    // data
    const { key, Codec } = serialize.serviceData(serviceId);
    serialized.set(key, Encoder.encodeObject(Codec, service.getInfo()));

    // preimages
    for (const preimage of service.data.preimages.values()) {
      const { key, Codec } = serialize.servicePreimages(serviceId, preimage.hash);
      serialized.set(key, Encoder.encodeObject(Codec, preimage.blob));
    }

    // storage
    for (const storage of service.data.storage.values()) {
      const { key, Codec } = serialize.serviceStorage(serviceId, storage.key);
      serialized.set(key, Encoder.encodeObject(Codec, storage.value));
    }

    // lookup history
    for (const lookupHistoryList of service.data.lookupHistory.values()) {
      for (const lookupHistory of lookupHistoryList) {
        const { key, Codec } = serialize.serviceLookupHistory(serviceId, lookupHistory.hash, lookupHistory.length);
        serialized.set(key, Encoder.encodeObject(Codec, lookupHistory.slots.slice()));
      }
    }
  }

  return serialized;
}
