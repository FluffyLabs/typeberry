import {
  codecPerEpochBlock,
  codecPerValidator,
  type EntropyHash,
  type ServiceId,
  type TimeSlot,
} from "@typeberry/block";
import { codecFixedSizeArray, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/refine-context.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Descriptor, readonlyArray } from "@typeberry/codec";
import { HashSet, SortedArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import {
  AvailabilityAssignment,
  codecPerCore,
  DisputesRecords,
  ENTROPY_ENTRIES,
  PrivilegedServices,
  ServiceAccountInfo,
  type State,
  StatisticsData,
  type StorageKey,
  ValidatorData,
} from "@typeberry/state";
import { AccumulationOutput, accumulationOutputComparator } from "@typeberry/state/accumulation-output.js";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { RecentBlocksHistory } from "@typeberry/state/recent-blocks.js";
import { SafroleData } from "@typeberry/state/safrole-data.js";
import { type StateKey, StateKeyIdx, stateKeys } from "./keys.js";

export type StateCodec<T> = {
  key: StateKey;
  Codec: Descriptor<T>;
  extract: (s: State) => T;
};

/** Serialization for particular state entries. */
export namespace serialize {
  /** C(1): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b15013b1501?v=0.6.7 */
  export const authPools: StateCodec<State["authPools"]> = {
    key: stateKeys.index(StateKeyIdx.Alpha),
    Codec: codecPerCore(
      codecKnownSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), {
        minLength: 0,
        maxLength: MAX_AUTH_POOL_SIZE,
        typicalLength: MAX_AUTH_POOL_SIZE,
      }),
    ),
    extract: (s) => s.authPools,
  };

  /** C(2): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b31013b3101?v=0.6.7 */
  export const authQueues: StateCodec<State["authQueues"]> = {
    key: stateKeys.index(StateKeyIdx.Phi),
    Codec: codecPerCore(
      codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), AUTHORIZATION_QUEUE_SIZE),
    ),
    extract: (s) => s.authQueues,
  };

  /**
   * C(3): Recent blocks with compatibility
   *  https://graypaper.fluffylabs.dev/#/7e6ff6a/3b3e013b3e01?v=0.6.7
   */
  export const recentBlocks: StateCodec<State["recentBlocks"]> = {
    key: stateKeys.index(StateKeyIdx.Beta),
    Codec: RecentBlocksHistory.Codec,
    extract: (s) => s.recentBlocks,
  };

  /** C(4): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b63013b6301?v=0.6.7 */
  export const safrole: StateCodec<SafroleData> = {
    key: stateKeys.index(StateKeyIdx.Gamma),
    Codec: SafroleData.Codec,
    extract: (s) =>
      SafroleData.create({
        nextValidatorData: s.nextValidatorData,
        epochRoot: s.epochRoot,
        sealingKeySeries: s.sealingKeySeries,
        ticketsAccumulator: s.ticketsAccumulator,
      }),
  };

  /** C(5): https://graypaper.fluffylabs.dev/#/7e6ff6a/3bba013bba01?v=0.6.7 */
  export const disputesRecords: StateCodec<State["disputesRecords"]> = {
    key: stateKeys.index(StateKeyIdx.Psi),
    Codec: DisputesRecords.Codec,
    extract: (s) => s.disputesRecords,
  };

  /** C(6): https://graypaper.fluffylabs.dev/#/7e6ff6a/3bf3013bf301?v=0.6.7 */
  export const entropy: StateCodec<State["entropy"]> = {
    key: stateKeys.index(StateKeyIdx.Eta),
    Codec: codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque<EntropyHash>(), ENTROPY_ENTRIES),
    extract: (s) => s.entropy,
  };

  /** C(7): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b00023b0002?v=0.6.7 */
  export const designatedValidators: StateCodec<State["designatedValidatorData"]> = {
    key: stateKeys.index(StateKeyIdx.Iota),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.designatedValidatorData,
  };

  /** C(8): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b0d023b0d02?v=0.6.7 */
  export const currentValidators: StateCodec<State["currentValidatorData"]> = {
    key: stateKeys.index(StateKeyIdx.Kappa),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.currentValidatorData,
  };

  /** C(9): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b1a023b1a02?v=0.6.7 */
  export const previousValidators: StateCodec<State["previousValidatorData"]> = {
    key: stateKeys.index(StateKeyIdx.Lambda),
    Codec: codecPerValidator(ValidatorData.Codec),
    extract: (s) => s.previousValidatorData,
  };

  /** C(10): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b27023b2702?v=0.6.7 */
  export const availabilityAssignment: StateCodec<State["availabilityAssignment"]> = {
    key: stateKeys.index(StateKeyIdx.Rho),
    Codec: codecPerCore(codec.optional(AvailabilityAssignment.Codec)),
    extract: (s) => s.availabilityAssignment,
  };

  /** C(11): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b3e023b3e02?v=0.6.7 */
  export const timeslot: StateCodec<State["timeslot"]> = {
    key: stateKeys.index(StateKeyIdx.Tau),
    Codec: codec.u32.asOpaque<TimeSlot>(),
    extract: (s) => s.timeslot,
  };

  /** C(12): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b4c023b4c02?v=0.6.7 */
  export const privilegedServices: StateCodec<State["privilegedServices"]> = {
    key: stateKeys.index(StateKeyIdx.Chi),
    Codec: PrivilegedServices.Codec,
    extract: (s) => s.privilegedServices,
  };

  /** C(13): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b5e023b5e02?v=0.6.7 */
  export const statistics: StateCodec<State["statistics"]> = {
    key: stateKeys.index(StateKeyIdx.Pi),
    Codec: StatisticsData.Codec,
    extract: (s) => s.statistics,
  };

  /** C(14): https://graypaper.fluffylabs.dev/#/1c979cb/3bf0023bf002?v=0.7.1 */
  export const accumulationQueue: StateCodec<State["accumulationQueue"]> = {
    key: stateKeys.index(StateKeyIdx.Omega),
    Codec: codecPerEpochBlock(readonlyArray(codec.sequenceVarLen(NotYetAccumulatedReport.Codec))),
    extract: (s) => s.accumulationQueue,
  };

  /** C(15): https://graypaper.fluffylabs.dev/#/7e6ff6a/3b96023b9602?v=0.6.7 */
  export const recentlyAccumulated: StateCodec<State["recentlyAccumulated"]> = {
    key: stateKeys.index(StateKeyIdx.Xi),
    Codec: codecPerEpochBlock(
      codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>()).convert(
        (x) => Array.from(x),
        (x) => HashSet.from(x),
      ),
    ),
    extract: (s) => s.recentlyAccumulated,
  };

  /** C(16): https://graypaper.fluffylabs.dev/#/38c4e62/3b46033b4603?v=0.7.0 */
  export const accumulationOutputLog: StateCodec<State["accumulationOutputLog"]> = {
    key: stateKeys.index(StateKeyIdx.Theta),
    Codec: codec.sequenceVarLen(AccumulationOutput.Codec).convert(
      (i) => i.array,
      (o) => SortedArray.fromSortedArray(accumulationOutputComparator, o),
    ),
    extract: (s) => s.accumulationOutputLog,
  };

  /** C(255, s): https://graypaper.fluffylabs.dev/#/85129da/383103383103?v=0.6.3 */
  export const serviceData = (serviceId: ServiceId) => ({
    key: stateKeys.serviceInfo(serviceId),
    Codec: ServiceAccountInfo.Codec,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/384803384803?v=0.6.3 */
  export const serviceStorage = (serviceId: ServiceId, key: StorageKey) => ({
    key: stateKeys.serviceStorage(serviceId, key),
    Codec: dumpCodec,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/385b03385b03?v=0.6.3 */
  export const servicePreimages = (serviceId: ServiceId, hash: PreimageHash) => ({
    key: stateKeys.servicePreimage(serviceId, hash),
    Codec: dumpCodec,
  });

  /** https://graypaper.fluffylabs.dev/#/85129da/387603387603?v=0.6.3 */
  export const serviceLookupHistory = (serviceId: ServiceId, hash: PreimageHash, len: U32) => ({
    key: stateKeys.serviceLookupHistory(serviceId, hash, len),
    Codec: readonlyArray(codec.sequenceVarLen(codec.u32)),
  });
}

/**
 * Just dump the entire terminal blob as-is.
 *
 * NOTE this is most likely NOT what you need! `dump` cannot
 * determine the boundary of the bytes, so it can only be used
 * as the last element of the codec and can't be used in sequences!
 */
export const dumpCodec = Descriptor.new<BytesBlob>(
  "Dump",
  { bytes: 64, isExact: false },
  (e, v) => e.bytes(Bytes.fromBlob(v.raw, v.raw.length)),
  (d) => BytesBlob.blobFrom(d.bytes(d.source.length - d.bytesRead()).raw),
  (s) => s.bytes(s.decoder.source.length - s.decoder.bytesRead()),
);
