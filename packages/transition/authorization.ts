import {CoreIndex, tryAsCoreIndex} from "@typeberry/block";
import {O} from "@typeberry/block/gp-constants";
import {AuthorizerHash} from "@typeberry/block/work-report";
import {KnownSizeArray} from "@typeberry/collections";
import {HashSet} from "@typeberry/collections/hash-set";
import {ChainSpec} from "@typeberry/config";
import {asOpaqueType} from "@typeberry/utils";

const MAX_NUMBER_OF_AUTHORIZATIONS_IN_POOL = O;

/** One entry of kind `T` for each core. */
export type PerCore<T> = KnownSizeArray<T, "number of cores">;

/** Authorization state. */
export type AuthorizationState = {
  /**
   * `α`: Authorizers available for each core (authorizer pool).
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authPools: PerCore<KnownSizeArray<AuthorizerHash, "At most `O`">>,
  /**
   * `φ`: A queue of authorizers for each core used to fill up the pool.
   *
   * Only updated by `accumulate` calls using `assign` host call.
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authQueues: PerCore<KnownSizeArray<AuthorizerHash, "At most `Q`">>,
};

/**
 * Input to the authorization.
 *
 * This is an excerpt from Guarantees extrinsic, containing just the core
 * index and the authorizer hash.
 */
export type AuthorizationInput = Map<CoreIndex, HashSet<AuthorizerHash>>;

/**
 * Maintain a list of available authorizations per core.
 *
 * The authorizer hashes are first added to the `queue` by some service via `assign`
 * host call (up to `Q` elements).
 * Each block we fill up the `pool` to always have `O` entries and we use the `queue`
 * to take missing values.
 * Every time there is a guaranteed work report (we know that from Gaurantees Extrinsic),
 * we check what `authorizerHash` was used for that work report and we remove it from
 * the `queue`.
 */
export class Authorization {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AuthorizationState,
  ) {}

  transition(input: AuthorizationInput) {
    // we transition authorizations for each core.
    for (let coreIndex = tryAsCoreIndex(0); coreIndex < this.chainSpec.coresCount; coreIndex++) {
      const usedHashes = input.get(coreIndex);
      let pool = this.state.authPools[coreIndex];
      let queue = this.state.authQueues[coreIndex];
      // if there were any used hashes - remove them
      if (usedHashes) {
        pool = asOpaqueType(pool.filter(x => usedHashes.has(x)));
      }

      // now fill up the pool if there is anything missing.
      const missingEntries = MAX_NUMBER_OF_AUTHORIZATIONS_IN_POOL - pool.length;
      if (missingEntries > 0) {
        const toAdd = queue.splice(0, missingEntries);
        pool.push(...toAdd);
      }

      // assign back to state
      this.state.authPools[coreIndex] = pool;
      this.state.authQueues[coreIndex] = queue;
    }
  }
}
