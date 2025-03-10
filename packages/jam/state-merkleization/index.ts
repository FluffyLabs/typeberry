/**
 * JAM State Serialization & Merkleization.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/389f00389f00
 */

import {FixedSizeArray, HashDictionary, KnownSizeArray, asKnownSize} from "@typeberry/collections";
import {U8, u32AsLeBytes, writeU32} from "@typeberry/numbers";
import {Bytes, BytesBlob} from "@typeberry/bytes";
import {Opaque} from "@typeberry/utils";
import {HASH_SIZE, OpaqueHash} from "@typeberry/hash";
import {PerValidator, ServiceId} from "@typeberry/block";
import {AvailabilityAssignment, BlockState, DisputesRecords, ENTROPY_ENTRIES, PerCore, State, ValidatorData, tryAsPerCore} from "@typeberry/state";
import {Codec, Descriptor, Encoder, SequenceView, codec} from "@typeberry/codec";
import {EST_CORES, EST_VALIDATORS} from "@typeberry/config";
import {withContext} from "@typeberry/block/context";
import {AuthorizerHash} from "@typeberry/block/work-report";
import {AUTHORIZATION_QUEUE_SIZE} from "@typeberry/block/gp-constants";

// TODO [ToDr]
// Define state mapping as an enum.
// Compare performance between:
// 1. generator
// 2. returning an array / Uint8Array
// 3. calling "writeInto" function.

type StateKey = Opaque<OpaqueHash, "stateKey">;
type SerializedState = HashDictionary<StateKey, BytesBlob>;

enum StateEntry {
  Unused = 0,
  /**Authorizer Pool */
  Alpha = 1,
  /** Authorizer Queue */
  Phi = 2,
  /** Recent History */
  Beta = 3,
  /** Safrole */
  Gamma = 4,
  /** Disputes Records (Judgements) */
  Psi = 5,
  /** Entropy */
  Eta = 6,
  /** Next Validators */
  Iota = 7,
  /** Current Validators */
  Kappa = 8,
  /** Previous Validators */
  Lambda = 9,
  /** Availability Assignment */
  Rho = 10,
  /** Current time slot */
  Tau = 11,
  /** Privileged Services */
  Chi = 12,
   /** Statistics */
  Pi = 13,
  /** Work Packages ready to be accumulated */
  Theta = 14,
  /** Work Packages recently accumulated */
  Ksi = 15,
  /** Services data */
  Delta = 255,
}

const codecPerCore = <T, V>(val: Descriptor<T, V>): Descriptor<PerCore<T>, SequenceView<T, V>> => codec.select({
  name: `PerCore<${val.name}>`,
  sizeHint: { bytes: Math.ceil(EST_CORES / 8), isExact: false },
},
  withContext(`PerCore<${val.name}>`, (context) => {
    return codec.sequenceFixLen(val, context.coresCount).asOpaque();
  }),
);

const codecPerValidator = <T, V>(val: Descriptor<T, V>): Descriptor<PerValidator<T>, SequenceView<T, V>> => codec.select({
  name: `PerValidator<${val.name}>`,
  sizeHint: { bytes: EST_VALIDATORS * val.sizeHint.bytes, isExact: false },
},
  withContext(`PerValidator<${val.name}>`, (context) => {
    return codec.sequenceFixLen(val, context.validatorsCount).asOpaque();
  }),
);

const codecKnownSizeArray = <T, V, F extends string>(val: Descriptor<T[], SequenceView<T, V>>): Descriptor<KnownSizeArray<T, F>, SequenceView<T, V>> => {
  return val.asOpaque();
};

const codecFixedSizeArray = <T, V, N extends number>(val: Descriptor<T, V>, len: N): Descriptor<FixedSizeArray<T, N>> => {
  return codec.sequenceFixLen(val, len).convert(
    (i) => i,
    (o) => FixedSizeArray.new(o, len),
  );
};

type StateCodec<T> = {
  key: StateKey;
  Codec: Descriptor<T>;
};

namespace serialize {
  /** C(1): https://graypaper.fluffylabs.dev/#/85129da/38a20138a201?v=0.6.3 */
  export const authPools: StateCodec<State['authPools']> = {
    key: encoder.index(StateEntry.Alpha),
    Codec: codecPerCore(codecKnownSizeArray(codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque()))),
  };

  /** C(2): https://graypaper.fluffylabs.dev/#/85129da/38be0138be01?v=0.6.3 */
  export const authQueues: StateCodec<State['authQueues']> = {
    key: encoder.index(StateEntry.Phi),
    Codec: codecPerCore(codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque(), AUTHORIZATION_QUEUE_SIZE)),
  };

  /** C(3): https://graypaper.fluffylabs.dev/#/85129da/38cb0138cb01?v=0.6.3 */
  export const recentBlocks: StateCodec<State['recentBlocks']> = {
    key: encoder.index(StateEntry.Beta),
    Codec: codecKnownSizeArray(codec.sequenceVarLen(BlockState.Codec)),
  };

  /** C(4): https://graypaper.fluffylabs.dev/#/85129da/38e60138e601?v=0.6.3 */
  export const safrole = {
    key: encoder.index(StateEntry.Gamma),
    // TODO [ToDr] Safrole state?
  };

  /** C(5): https://graypaper.fluffylabs.dev/#/85129da/383d02383d02?v=0.6.3 */
  export const disputesRecords: StateCodec<State['disputesRecords']> = {
    key: encoder.index(StateEntry.Psi),
    Codec: DisputesRecords.Codec,
  };

  /** C(6): https://graypaper.fluffylabs.dev/#/85129da/387602387602?v=0.6.3 */
  export const entropy: StateCodec<State['entropy']> = {
    key: encoder.index(StateEntry.Eta),
    Codec: codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque(), ENTROPY_ENTRIES),
  };

  /** C(7): https://graypaper.fluffylabs.dev/#/85129da/388302388302?v=0.6.3 */
  export const designatedValidators: StateCodec<State['designatedValidatorData']> = {
    key: encoder.index(StateEntry.Iota),
    Codec: codecPerValidator(ValidatorData.Codec),
  };

  /** C(8): https://graypaper.fluffylabs.dev/#/85129da/389002389002?v=0.6.3 */
  export const currentValidators: StateCodec<State['currentValidatorData']> = {
    key: encoder.index(StateEntry.Kappa),
    Codec: codecPerValidator(ValidatorData.Codec),
  };

  /** C(9): https://graypaper.fluffylabs.dev/#/85129da/389d02389d02?v=0.6.3 */
  export const previousValidators: StateCodec<State['previousValidatorData']> = {
    key: encoder.index(StateEntry.Lambda),
    Codec: codecPerValidator(ValidatorData.Codec),
  };

  /** C(10): https://graypaper.fluffylabs.dev/#/85129da/38aa0238aa02?v=0.6.3 */
  export const availabilityAssignment: StateCodec<State['availabilityAssignment']> = {
    key: encoder.index(StateEntry.Rho),
    Codec: codecPerCore(codec.optional(AvailabilityAssignment.Codec)),
  };

  /** C(11): https://graypaper.fluffylabs.dev/#/85129da/38c10238c102?v=0.6.3 */
  export const timeslot: StateCodec<State['timeslot']> = {
    key: encoder.index(StateEntry.Tau),
    Codec: codec.u32.asOpaque(),
  };

  /** C(12): https://graypaper.fluffylabs.dev/#/85129da/38cf0238cf02?v=0.6.3 */
  export const privilegedServices: StateCodec<State['privilegedServices']> = {
  };





}

// TODO [ToDr] could that be virtualized?
// 1. in case we just have one byte, we could return that byte and then return zero
// 2. in case service we could have a generator as well
// 3. Likewsize in (service + hash)
namespace encoder {
  export function index(index: StateEntry): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = index;
    return key.asOpaque();
  }

  export function serviceIndex(index: StateEntry, serviceId: ServiceId): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = index;
    let i = 1;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      i += 2;
    }
    return key.asOpaque();
  }

  export function serviceKey(serviceId: ServiceId, hash: OpaqueHash): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    let i = 0;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      key.raw[i + 1] = hash.raw[i / 2];
      i += 2;
    }
    return key.asOpaque();
  }
}

// // mapping:
// //    from 32-octet sequence (state-keys)
// //    BytesBlob
// function serialize(state: State) {
// }
