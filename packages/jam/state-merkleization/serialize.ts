import { EntropyHash, type ServiceId, TimeSlot, codecPerEpochBlock, codecPerValidator } from "@typeberry/block";
import { codecFixedSizeArray, codecKnownSizeArray } from "@typeberry/block/codec";
import { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants";
import type { PreimageHash } from "@typeberry/block/preimage";
import { type Descriptor, codec } from "@typeberry/codec";
import { HashSet } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import {
  ActivityData,
  AvailabilityAssignment,
  BlockState,
  DisputesRecords,
  ENTROPY_ENTRIES,
  MAX_RECENT_HISTORY,
  PrivilegedServices,
  ServiceAccountInfo,
  type State,
  ValidatorData,
  codecPerCore,
} from "@typeberry/state";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import { SafroleData } from "@typeberry/state/safrole-data";
import { StateEntry } from "./entries";
import { type StateKey, keys } from "./keys";
import {AuthorizerHash, WorkPackageHash} from "@typeberry/block/work-report";

export type StateCodec<T> = {
  key: StateKey;
  Codec: Descriptor<T>;
  extract: (s: State) => T;
};

/** Serialization for particular state entries. */
export namespace serialize {
  /** C(1): https://graypaper.fluffylabs.dev/#/85129da/38a20138a201?v=0.6.3 */
  export const authPools: StateCodec<State["authPools"]> = {
    key: keys.index(StateEntry.Alpha),
    Codec: codecPerCore(
      codecKnownSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), {
        minLength: 0,
        maxLength: MAX_AUTH_POOL_SIZE,
        typicalLength: MAX_AUTH_POOL_SIZE,
      }),
    ),
    extract: (s) => s.authPools,
  };

  /** C(2): https://graypaper.fluffylabs.dev/#/85129da/38be0138be01?v=0.6.3 */
  export const authQueues: StateCodec<State["authQueues"]> = {
    key: keys.index(StateEntry.Phi),
    Codec: codecPerCore(codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), AUTHORIZATION_QUEUE_SIZE)),
    extract: (s) => s.authQueues,
  };

  /** C(3): https://graypaper.fluffylabs.dev/#/85129da/38cb0138cb01?v=0.6.3 */
  export const recentBlocks: StateCodec<State["recentBlocks"]> = {
    key: keys.index(StateEntry.Beta),
    Codec: codecKnownSizeArray(BlockState.Codec, {
      minLength: 0,
      maxLength: MAX_RECENT_HISTORY,
      typicalLength: MAX_RECENT_HISTORY,
    }),
    extract: (s) => s.recentBlocks,
  };

  /** C(4): https://graypaper.fluffylabs.dev/#/85129da/38e60138e601?v=0.6.3 */
  export const safrole: StateCodec<SafroleData> = {
    key: keys.index(StateEntry.Gamma),
    Codec: SafroleData.Codec,
    extract: (s) => new SafroleData(s.nextValidatorData, s.epochRoot, s.sealingKeySeries, s.ticketsAccumulator),
  };

  /** C(5): https://graypaper.fluffylabs.dev/#/85129da/383d02383d02?v=0.6.3 */
  export const disputesRecords: StateCodec<State["disputesRecords"]> = {
    key: keys.index(StateEntry.Psi),
    Codec: DisputesRecords.Codec,
    extract: (s) => s.disputesRecords,
  };

  /** C(6): https://graypaper.fluffylabs.dev/#/85129da/387602387602?v=0.6.3 */
  export const entropy: StateCodec<State["entropy"]> = {
    key: keys.index(StateEntry.Eta),
    Codec: codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque<EntropyHash>(), ENTROPY_ENTRIES),
    extract: (s) => s.entropy,
  };

  /** C(7): https://graypaper.fluffylabs.dev/#/85129da/388302388302?v=0.6.3 */
  export const designatedValidators: StateCodec<State["designatedValidatorData"]> = {
    key: keys.index(StateEntry.Iota),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.designatedValidatorData,
  };

  /** C(8): https://graypaper.fluffylabs.dev/#/85129da/389002389002?v=0.6.3 */
  export const currentValidators: StateCodec<State["currentValidatorData"]> = {
    key: keys.index(StateEntry.Kappa),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.currentValidatorData,
  };

  /** C(9): https://graypaper.fluffylabs.dev/#/85129da/389d02389d02?v=0.6.3 */
  export const previousValidators: StateCodec<State["previousValidatorData"]> = {
    key: keys.index(StateEntry.Lambda),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.previousValidatorData,
  };

  /** C(10): https://graypaper.fluffylabs.dev/#/85129da/38aa0238aa02?v=0.6.3 */
  export const availabilityAssignment: StateCodec<State["availabilityAssignment"]> = {
    key: keys.index(StateEntry.Rho),
    Codec: codecPerCore(codec.optional(AvailabilityAssignment.Codec)),
    extract: (s) => s.availabilityAssignment,
  };

  /** C(11): https://graypaper.fluffylabs.dev/#/85129da/38c10238c102?v=0.6.3 */
  export const timeslot: StateCodec<State["timeslot"]> = {
    key: keys.index(StateEntry.Tau),
    Codec: codec.u32.asOpaque<TimeSlot>(),
    extract: (s) => s.timeslot,
  };

  /** C(12): https://graypaper.fluffylabs.dev/#/85129da/38cf0238cf02?v=0.6.3 */
  export const privilegedServices: StateCodec<State["privilegedServices"]> = {
    key: keys.index(StateEntry.Chi),
    Codec: PrivilegedServices.Codec,
    extract: (s) => s.privilegedServices,
  };

  /** C(13): https://graypaper.fluffylabs.dev/#/85129da/38e10238e102?v=0.6.3 */
  export const statistics: StateCodec<State["statisticsPerValidator"]> = {
    key: keys.index(StateEntry.Pi),
    Codec: ActivityData.Codec,
    extract: (s) => s.statisticsPerValidator,
  };

  /** C(14): https://graypaper.fluffylabs.dev/#/85129da/38f80238f802?v=0.6.3 */
  export const accumulationQueue: StateCodec<State["accumulationQueue"]> = {
    key: keys.index(StateEntry.Theta),
    Codec: codecPerEpochBlock(codec.sequenceVarLen(NotYetAccumulatedReport.Codec)),
    extract: (s) => s.accumulationQueue,
  };

  /** C(15): https://graypaper.fluffylabs.dev/#/85129da/381903381903?v=0.6.3 */
  export const recentlyAccumulated: StateCodec<State["recentlyAccumulated"]> = {
    key: keys.index(StateEntry.Xi),
    Codec: codecPerEpochBlock(
      codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>()).convert(
        (x) => Array.from(x),
        (x) => HashSet.from(x),
      ),
    ),
    extract: (s) => s.recentlyAccumulated,
  };

  /** C(255, s): https://graypaper.fluffylabs.dev/#/85129da/383103383103?v=0.6.3 */
  export const serviceData = (serviceId: ServiceId) => ({
    key: keys.serviceInfo(serviceId),
    Codec: ServiceAccountInfo.Codec,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/384803384803?v=0.6.3 */
  export const serviceStorage = (serviceId: ServiceId, key: StateKey) => ({
    key: keys.serviceStorage(serviceId, key),
    Codec: codec.dump,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/385b03385b03?v=0.6.3 */
  export const servicePreimages = (serviceId: ServiceId, hash: PreimageHash) => ({
    key: keys.servicePreimage(serviceId, hash),
    Codec: codec.dump,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/387603387603?v=0.6.3 */
  export const serviceLookupHistory = (serviceId: ServiceId, hash: PreimageHash, len: U32) => ({
    key: keys.serviceLookupHistory(serviceId, hash, len),
    Codec: codec.sequenceVarLen(codec.u32),
  });
}
