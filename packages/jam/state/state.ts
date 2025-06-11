import type { EntropyHash, PerEpochBlock, PerValidator, ServiceId, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/work-report.js";
import type { FixedSizeArray, ImmutableHashSet, KnownSizeArray } from "@typeberry/collections";
import type { AvailabilityAssignment } from "./assurances.js";
import type { BlockState } from "./block-state.js";
import type { PerCore } from "./common.js";
import type { DisputesRecords } from "./disputes.js";
import type { NotYetAccumulatedReport } from "./not-yet-accumulated.js";
import type { PrivilegedServices } from "./privileged-services.js";
import type { SafroleData } from "./safrole-data.js";
import type { LookupHistoryItem, PreimageItem, ServiceAccountInfo, StorageItem, StorageKey } from "./service.js";
import type { StatisticsData } from "./statistics.js";
import type { ValidatorData } from "./validator-data.js";

/**
 * In addition to the entropy accumulator η_0, we retain
 * three additional historical values of the accumulator at
 * the point of each of the three most recently ended epochs,
 * η_1, η_2 and η_3. The second-oldest of these η2 is utilized to
 * help ensure future entropy is unbiased (see equation 6.29)
 * and seed the fallback seal-key generation function with
 * randomness (see equation 6.24). The oldest is used to re-
 * generate this randomness when verifying the seal above
 * (see equations 6.16 and 6.15).
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0ef5010ef501
 */
export const ENTROPY_ENTRIES = 4;
export type ENTROPY_ENTRIES = typeof ENTROPY_ENTRIES;

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/416300416500
 */
export const MAX_RECENT_HISTORY = 8;
export type MAX_RECENT_HISTORY = typeof MAX_RECENT_HISTORY;

/**
 * State object with additional ability to enumerate
 * it's services entries.
 */
export type EnumerableState = {
  /**
   * `δ delta`:  In summary, δ is the portion of state dealing with
   *             services, analogous in Jam to the Yellow Paper’s (
   *             smart contract) accounts.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/08fb0008ff00
   */
  serviceIds(): readonly ServiceId[];
};

/**
 * Complete state tuple with all entries.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/08f10008f100
 */
export type State = {
  /**

   * `ρ rho`: work-reports which have been reported but are not yet known to be
   *          available to a super-majority of validators, together with the time
   *          at which each was reported.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/135800135800
   */
  readonly availabilityAssignment: PerCore<AvailabilityAssignment | null>;

  /**
   * `ι iota`: The validator keys and metadata to be drawn from next.
   */
  readonly designatedValidatorData: PerValidator<ValidatorData>;

  /**
   * `γₖ gamma_k`: The keys for the validators of the next epoch, equivalent to those keys which constitute γ_z .
   */
  readonly nextValidatorData: SafroleData["nextValidatorData"];

  /**
   * `κ kappa`: Validators, who are the set of economic actors uniquely
   *            privileged to help build and maintain the Jam chain, are
   *            identified within κ, archived in λ and enqueued from ι.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/080201080601
   */
  readonly currentValidatorData: PerValidator<ValidatorData>;

  /**
   * `λ lambda`: Validators, who are the set of economic actors uniquely
   *             privileged to help build and maintain the Jam chain, are
   *             identified within κ, archived in λ and enqueued from ι.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/080201080601
   */
  readonly previousValidatorData: PerValidator<ValidatorData>;

  /**
   * `ψ psi`: Judgements
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/091900091900
   */
  readonly disputesRecords: DisputesRecords;

  /**
   * `τ tau`: The current time slot.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/186401186401
   */
  readonly timeslot: TimeSlot;

  /**
   * `η eta`: An on-chain entropy pool is retained in η.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/080c01080d01
   */
  readonly entropy: FixedSizeArray<EntropyHash, ENTROPY_ENTRIES>;

  /**
   * `α alpha`: Authorizers available for each core (authorizer pool).
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  readonly authPools: PerCore<KnownSizeArray<AuthorizerHash, `At most ${typeof MAX_AUTH_POOL_SIZE}`>>;

  /**
   * `φ phi`: A queue of authorizers for each core used to fill up the pool.
   *
   * Only updated by `accumulate` calls using `assign` host call.
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  readonly authQueues: PerCore<FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>>;

  /**
   * `β beta`: State of the blocks from recent history.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/0fb7010fb701
   */
  readonly recentBlocks: KnownSizeArray<BlockState, `0..${typeof MAX_RECENT_HISTORY}`>;

  /**
   * `π pi`: Previous and current statistics of each validator,
   *         cores statistics and services statistics.
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/18f60118f601?v=0.6.4
   */
  readonly statistics: StatisticsData;

  /**
   * `ϑ theta`: We also maintain knowledge of ready (i.e. available
   * and/or audited) but not-yet-accumulated work-reports in
   * the state item ϑ.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/165300165500
   */
  readonly accumulationQueue: PerEpochBlock<readonly NotYetAccumulatedReport[]>;

  /**
   * `ξ xi`: In order to know which work-packages have been
   * accumulated already, we maintain a history of what has
   * been accumulated. This history, ξ, is sufficiently large
   * for an epoch worth of work-reports.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/161a00161d00
   */
  readonly recentlyAccumulated: PerEpochBlock<ImmutableHashSet<WorkPackageHash>>;

  /*
   * `γₐ gamma_a`: The ticket accumulator - a series of highest-scoring ticket identifiers to be
   *               used for the next epoch.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0dc3000dc500
   */
  readonly ticketsAccumulator: SafroleData["ticketsAccumulator"];

  /**
   * `γₛ gamma_s`: γs is the current epoch’s slot-sealer series, which is either a full complement
   *                of `E` tickets or, in the case of a fallback mode, a series of `E` Bandersnatch
   *                keys.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0dc6000dc800
   */
  readonly sealingKeySeries: SafroleData["sealingKeySeries"];

  /**
   * `γ_z gamma_z`: The epoch’s root, a Bandersnatch ring root composed with the one Bandersnatch
   *                key of each of the next epoch’s validators, defined in γ_k.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0da8000db800
   */
  readonly epochRoot: SafroleData["epochRoot"];

  /**
   * `χ chi`: Up to three services may be recognized as privileged. The portion of state in which
   *           this is held is denoted χ and has three service index components together with
   *           a gas limit.
   *
   * https://graypaper.fluffylabs.dev/#/85129da/116f01117201?v=0.6.3
   */
  readonly privilegedServices: PrivilegedServices;

  /**
   * Retrieve details about single service.
   */
  getService(id: ServiceId): Service | null;
};

/** Service details. */
export interface Service {
  /** Retrieve service account info. */
  getInfo(): ServiceAccountInfo;

  /** Read one particular storage item. */
  getStorage(storage: StorageKey): StorageItem | null;

  /** Check if preimage is present. */
  hasPreimage(hash: PreimageHash): boolean;

  /** Retrieve a preimage. */
  getPreimage(hash: PreimageHash): PreimageItem | null;

  /** Retrieve lookup history of a preimage. */
  getLookupHistory(hash: PreimageHash): LookupHistoryItem[] | null;
}
