import type { BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { InMemoryState } from "@typeberry/state";
import type { StateKey } from "./keys";
import { type StateCodec, serialize } from "./serialize";

export type StateEntries = HashDictionary<StateKey, BytesBlob>;

/** https://graypaper.fluffylabs.dev/#/68eaa1f/38a50038a500?v=0.6.4 */
export function serializeInMemoryState(state: InMemoryState, spec: ChainSpec): StateEntries {
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
      const { key, Codec } = serialize.serviceStorage(serviceId, storage.hash);
      serialized.set(key, Encoder.encodeObject(Codec, storage.blob));
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
