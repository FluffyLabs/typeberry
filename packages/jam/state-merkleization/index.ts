/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

import type { BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { State } from "@typeberry/state";
import type { StateKey } from "./keys";
import { type StateCodec, serialize } from "./serialize";

export type SerializedState = HashDictionary<StateKey, BytesBlob>;

export function serializeState(state: State, spec: ChainSpec): SerializedState {
  const map = HashDictionary.new<StateKey, BytesBlob>();
  function doSerialize<T>(codec: StateCodec<T>) {
    map.set(codec.key, Encoder.encodeObject(codec.Codec, codec.extract(state), spec));
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
  for (const service of state.services.values()) {
    const serviceId = service.id;
    // data
    const { key, Codec } = serialize.serviceData(serviceId);
    map.set(key, Encoder.encodeObject(Codec, service.data.info));

    // preimages
    for (const preimage of service.data.preimages) {
      const { key, Codec } = serialize.servicePreimages(serviceId, preimage.hash);
      map.set(key, Encoder.encodeObject(Codec, preimage.blob));
    }

    // storage
    for (const storage of service.data.storage) {
      const { key, Codec } = serialize.serviceStorage(serviceId, storage.hash);
      map.set(key, Encoder.encodeObject(Codec, storage.blob));
    }

    // lookup history
    for (const lookupHistory of service.data.lookupHistory) {
      const { key, Codec } = serialize.serviceLookupHistory(serviceId, lookupHistory.hash, lookupHistory.length);
      map.set(key, Encoder.encodeObject(Codec, lookupHistory.slots));
    }
  }

  return map;
}
