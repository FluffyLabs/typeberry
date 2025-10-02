import type { EntropyHash, PerEpochBlock, PerValidator, ServiceId, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/refine-context.js";
import type { FixedSizeArray, ImmutableHashSet, KnownSizeArray, SortedArray } from "@typeberry/collections";
import type { AccumulationOutput } from "./accumulation-output.js";
import type { AvailabilityAssignment, StateAvailabilityAssignmentView } from "./assurances.js";
import type { PerCore } from "./common.js";
import type { DisputesRecords } from "./disputes.js";
import type { NotYetAccumulatedReport } from "./not-yet-accumulated.js";
import type { PrivilegedServices } from "./privileged-services.js";
import type { RecentBlocksHistory } from "./recent-blocks.js";
import type { SafroleData } from "./safrole-data.js";
import type { ServiceAccountInfo } from "./service.js";
import type { StatisticsData } from "./statistics.js";
import type { ValidatorData } from "./validator-data.js";
import {DescribedBy} from "@typeberry/codec";

/**
 * A non-decoding version of the `State`.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/08f10008f100
 */
export type StateView = {
  /**

   * `ρ rho`: work-reports which have been reported but are not yet known to be
   *          available to a super-majority of validators, together with the time
   *          at which each was reported.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/135800135800
   */
  readonly availabilityAssignment: StateAvailabilityAssignmentView;

  /**
   * `ι iota`: The validator keys and metadata to be drawn from next.
   */
  readonly designatedValidatorData: PerValidator<ValidatorData>;

  /**
   * `γₖ gamma_k`: The keys for the validators of the next epoch, equivalent to those keys which constitute γ_z .
   */
  readonly nextValidatorData: PerValidator<ValidatorData>;

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
  readonly recentBlocks: RecentBlocksHistory;

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
   * `θ theta`: Sequence of merkle mountain belts from recent accumulations
   *            with service that accumulated them.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/3bad023bad02?v=0.6.7
   *
   * NOTE Maximum size of this array is unspecified in GP
   */
  readonly accumulationOutputLog: SortedArray<AccumulationOutput>;

  /** Retrieve details about single service. */
  getServiceInfoView(id: ServiceId): DescribedBy<typeof ServiceAccountInfo.Codec.View> | null;
};
