/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

import type { StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { InMemoryState } from "@typeberry/state";
import { InMemoryTrie, WriteableNodesDb } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher";
import { WithDebug, asOpaqueType } from "@typeberry/utils";
import type { StateKey } from "./keys";
import { type StateCodec, serialize } from "./serialize";

export class StateEntry extends WithDebug {
  static Codec = codec.Class(StateEntry, {
    key: codec.bytes(HASH_SIZE).asOpaque<StateKey>(),
    value: codec.blob,
  });

  static create({ key, value }: CodecRecord<StateEntry>) {
    return new StateEntry(key, value);
  }

  private constructor(
    public readonly key: StateKey,
    public readonly value: BytesBlob,
  ) {
    super();
  }
}
export type SerializedState = StateEntry[];

/** https://graypaper.fluffylabs.dev/#/68eaa1f/391600391600?v=0.6.4 */
export function merkelizeState(state: SerializedState): StateRootHash {
  const trie = new InMemoryTrie(new WriteableNodesDb(blake2bTrieHasher));
  for (const { key, value } of state) {
    trie.set(key, value);
  }
  return asOpaqueType(trie.getRootHash());
}

/** https://graypaper.fluffylabs.dev/#/68eaa1f/38a50038a500?v=0.6.4 */
export function serializeState(state: InMemoryState, spec: ChainSpec): SerializedState {
  const raw: StateEntry[] = [];
  function doSerialize<T>(codec: StateCodec<T>) {
    raw.push(
      StateEntry.create({ key: codec.key, value: Encoder.encodeObject(codec.Codec, codec.extract(state), spec) }),
    );
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
    raw.push(StateEntry.create({ key, value: Encoder.encodeObject(Codec, service.getInfo()) }));

    // preimages
    for (const preimage of service.data.preimages.values()) {
      const { key, Codec } = serialize.servicePreimages(serviceId, preimage.hash);
      raw.push(StateEntry.create({ key, value: Encoder.encodeObject(Codec, preimage.blob) }));
    }

    // storage
    for (const storage of service.data.storage.values()) {
      const { key, Codec } = serialize.serviceStorage(serviceId, storage.hash);
      raw.push(StateEntry.create({ key, value: Encoder.encodeObject(Codec, storage.blob) }));
    }

    // lookup history
    for (const lookupHistoryList of service.data.lookupHistory.values()) {
      for (const lookupHistory of lookupHistoryList) {
        const { key, Codec } = serialize.serviceLookupHistory(serviceId, lookupHistory.hash, lookupHistory.length);
        raw.push(StateEntry.create({ key, value: Encoder.encodeObject(Codec, lookupHistory.slots.slice()) }));
      }
    }
  }

  return raw;
}
