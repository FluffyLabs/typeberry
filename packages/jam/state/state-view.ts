import type { ServiceId } from "@typeberry/block";

import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { SequenceView } from "@typeberry/codec";
import type { AccumulationQueueView } from "./accumulation-queue.js";
import type { AvailabilityAssignmentsView } from "./assurances.js";
import type { AuthorizationPool, AuthorizationQueue } from "./auth.js";
import type { RecentBlocksView } from "./recent-blocks.js";
import type { RecentlyAccumulatedView } from "./recently-accumulated.js";
import type { SafroleDataView } from "./safrole-data.js";
import type { ServiceAccountInfoView } from "./service.js";
import type { StatisticsDataView } from "./statistics.js";
import type { ValidatorData, ValidatorDataView } from "./validator-data.js";

/** Additional marker interface, when state view is supported/required. */
export type WithStateView<V = StateView> = {
  /** Get view of the state. */
  view(): V;
};

/**
 * A non-decoding version of the `State`.
 *
 * Note we don't require all fields to have view accessors, since
 * it's only beneficial for large collections to be read via views.
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
  availabilityAssignmentView(): AvailabilityAssignmentsView;

  /**
   * `ι iota`: The validator keys and metadata to be drawn from next.
   */
  designatedValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView>;

  /**
   * `κ kappa`: Validators, who are the set of economic actors uniquely
   *            privileged to help build and maintain the Jam chain, are
   *            identified within κ, archived in λ and enqueued from ι.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/080201080601
   */
  currentValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView>;

  /**
   * `λ lambda`: Validators, who are the set of economic actors uniquely
   *             privileged to help build and maintain the Jam chain, are
   *             identified within κ, archived in λ and enqueued from ι.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/080201080601
   */
  previousValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView>;

  /**
   * `α alpha`: Authorizers available for each core (authorizer pool).
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authPoolsView(): SequenceView<AuthorizationPool, SequenceView<AuthorizerHash>>;

  /**
   * `φ phi`: A queue of authorizers for each core used to fill up the pool.
   *
   * Only updated by `accumulate` calls using `assign` host call.
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authQueuesView(): SequenceView<AuthorizationQueue, SequenceView<AuthorizerHash>>;

  /**
   * `β beta`: State of the blocks from recent history.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/0fb7010fb701
   */
  recentBlocksView(): RecentBlocksView;

  /**
   * `π pi`: Previous and current statistics of each validator,
   *         cores statistics and services statistics.
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/18f60118f601?v=0.6.4
   */
  statisticsView(): StatisticsDataView;

  /**
   * `ϑ theta`: We also maintain knowledge of ready (i.e. available
   * and/or audited) but not-yet-accumulated work-reports in
   * the state item ϑ.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/165300165500
   */
  accumulationQueueView(): AccumulationQueueView;

  /**
   * `ξ xi`: In order to know which work-packages have been
   * accumulated already, we maintain a history of what has
   * been accumulated. This history, ξ, is sufficiently large
   * for an epoch worth of work-reports.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/161a00161d00
   */
  recentlyAccumulatedView(): RecentlyAccumulatedView;

  /*
   * `γ gamma`: Safrole data.
   */
  safroleDataView(): SafroleDataView;

  /** Retrieve details about single service. */
  getServiceInfoView(id: ServiceId): ServiceAccountInfoView | null;
};
