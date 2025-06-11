import { type CoreIndex, type TimeSlot, tryAsCoreIndex } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { asKnownSize } from "@typeberry/collections";
import type { HashSet } from "@typeberry/collections/hash-set.js";
import type { ChainSpec } from "@typeberry/config";
import { type State, tryAsPerCore } from "@typeberry/state";

/** Authorization state. */
export type AuthorizationState = Pick<State, "authPools" | "authQueues">;

/** Authorization state update. */
export type AuthorizationStateUpdate = Pick<AuthorizationState, "authPools">;

/** Input to the authorization. */
export type AuthorizationInput = {
  /** Current time slot. */
  slot: TimeSlot;

  /**
   * This is an excerpt from Guarantees extrinsic, containing just the core
   * index and the authorizer hash turned into a fast-lookup `Map+Set`.
   */
  used: Map<CoreIndex, HashSet<AuthorizerHash>>;
};

/**
 * Maintain a list of available authorizations per core.
 *
 * The authorizer hashes are first added to the `queue` by some service via `assign`
 * host call (up to `Q` elements).
 * Each block we fill up the `pool` to always have `O` entries and we use the `queue`
 * to take missing values.
 * Every time there is a guaranteed work report (we know that from Guarantees Extrinsic),
 * we check what `authorizerHash` was used for that work report and we remove it from
 * the `queue`.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/0f94020f9402?v=0.6.4
 */
export class Authorization {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AuthorizationState,
  ) {}

  /**
   * The state transition of a block involves placing a new authorization
   * into the pool from the queue.
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/103e00103f00?v=0.6.4
   */
  transition(input: AuthorizationInput): AuthorizationStateUpdate {
    const authPoolsUpdate = this.state.authPools.slice();
    // we transition authorizations for each core.
    for (let coreIndex = tryAsCoreIndex(0); coreIndex < this.chainSpec.coresCount; coreIndex++) {
      let pool = authPoolsUpdate[coreIndex].slice();
      // the queue is only read (we should most likely use `ArrayView` here).
      const queue = this.state.authQueues[coreIndex];
      // if there were any used hashes - remove them
      const usedHashes = input.used.get(coreIndex);
      if (usedHashes !== undefined) {
        pool = pool.filter((x) => {
          // we only remove the left-most first occurrence.
          const wasRemoved = usedHashes.delete(x);
          return !wasRemoved;
        });
      }

      // fill the pool with authorizer for current slot.
      pool.push(queue[input.slot % AUTHORIZATION_QUEUE_SIZE]);

      // remove the excess from the front
      while (pool.length > MAX_AUTH_POOL_SIZE) {
        pool.shift();
      }

      // assign back to state
      authPoolsUpdate[coreIndex] = asKnownSize(pool);
    }

    return {
      authPools: tryAsPerCore(authPoolsUpdate, this.chainSpec),
    };
  }
}
