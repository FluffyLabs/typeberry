/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

import type { BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { State } from "@typeberry/state";
import type { StateKey } from "./keys";
import { type StateCodec, serialize } from "./serialize";

export type SerializedState = HashDictionary<StateKey, BytesBlob>;

export function serializeState(state: State): SerializedState {
  const map = new HashDictionary<StateKey, BytesBlob>();
  function doSerialize<T>(codec: StateCodec<T>) {
    map.set(codec.key, Encoder.encodeObject(codec.Codec, codec.extract(state)));
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
  for (const service of state.services) {
    // data
    const { key, Codec } = serialize.serviceData(service.id);
    map.set(key, Encoder.encodeObject(Codec, service.data.info));

    // preimages
    for (const preimage of service.data.preimages) {
      const { key, Codec } = serialize.servicePreimages(service.id, preimage.hash);
      map.set(key, Encoder.encodeObject(Codec, preimage.blob));
    }

    // TODO [ToDr] Serialize service state (no state entry yet).
    // TODO [ToDr] Serialize lookup history (not state entry yet).
  }

  return map;
}
