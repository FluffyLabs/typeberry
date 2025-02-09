import type { EntropyHash, PerValidator, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants";
import type { AuthorizerHash } from "@typeberry/block/work-report";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { AvailabilityAssignment } from "./assurances";
import type { BlockState } from "./block-state";
import type { PerCore } from "./common";
import type { DisputesRecords } from "./disputes";
import type { Service } from "./service";
import type { ActivityData } from "./statistics";
import type { ValidatorData } from "./validator-data";

// TODO [ToDr] Docs

export const ENTROPY_ENTRIES = 4;
export type ENTROPY_ENTRIES = typeof ENTROPY_ENTRIES;

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/416300416500
 */
export const MAX_RECENT_HISTORY = 8;

export type State = {
  /**
   * `ρ rho`: work-reports which have been reported but are not yet known to be
   *        available to a super-majority of validators, together with the time
   *        at which each was reported.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/135800135800
   */
  readonly availabilityAssignment: PerCore<AvailabilityAssignment | null>;

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
   * `φ psi`: A queue of authorizers for each core used to fill up the pool.
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
   * `δ delta`:  In summary, δ is the portion of state dealing with
   *             services, analogous in Jam to the Yellow Paper’s (
   *             smart contract) accounts.
   *
   * TODO [ToDr] a dictionary?
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/08fb0008ff00
   */
  readonly services: Service[];

  /**
   * `π pi`: Previous and current statistics of each validator.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/181a01181c01
   */
  readonly statisticsPerValidator: ActivityData;
};
