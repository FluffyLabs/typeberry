import { type CoreIndex, type TimeSlot, tryAsCoreIndex } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE, O } from "@typeberry/block/gp-constants";
import type { AuthorizerHash } from "@typeberry/block/work-report";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { HashSet } from "@typeberry/collections/hash-set";
import type { ChainSpec } from "@typeberry/config";
import { asOpaqueType } from "@typeberry/utils";

export const MAX_NUMBER_OF_AUTHORIZATIONS_IN_POOL = O;

/** One entry of kind `T` for each core. */
export type PerCore<T> = KnownSizeArray<T, "number of cores">;

/** Authorization state. */
export type AuthorizationState = {
  /**
   * `α`: Authorizers available for each core (authorizer pool).
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authPools: PerCore<KnownSizeArray<AuthorizerHash, "At most `O`">>;
  /**
   * `φ`: A queue of authorizers for each core used to fill up the pool.
   *
   * Only updated by `accumulate` calls using `assign` host call.
   *
   * https://graypaper-reader.netlify.app/#/6e1c0cd/102400102400
   */
  authQueues: PerCore<FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>>;
};

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
      const usedHashes = input.used.get(coreIndex);
      let pool = this.state.authPools[coreIndex];
      // the queue is only read (we should most likely use `ArrayView` here).
      const queue = this.state.authQueues[coreIndex];
      // if there were any used hashes - remove them
      if (usedHashes) {
        pool = asOpaqueType(
          pool.filter((x) => {
            const shouldRemove = usedHashes.has(x);
            // don't remove twice
            if (shouldRemove) {
              usedHashes.delete(x);
            }
            return !shouldRemove;
          }),
        );
      }

      // fill the pool with authorizer for current slot.
      pool.push(queue[input.slot % AUTHORIZATION_QUEUE_SIZE]);

      // remove the excess from the front
      while (pool.length > MAX_NUMBER_OF_AUTHORIZATIONS_IN_POOL) {
        pool.shift();
      }

      // assign back to state
      this.state.authPools[coreIndex] = pool;
    }
  }
}

export function assertSameState(a: AuthorizerHash[][], b: AuthorizerHash[][], msg: string) {
  const errors: string[] = [];
  const cores = Math.max(a.length, b.length);
  if (a.length !== b.length) {
    errors.push(`(exp) ${a.length} !== ${b.length} (got) - cores length mismatch (${msg})`);
  }
  for (let core = 0; core < cores; core++) {
    const aCore = a[core] ?? [];
    const bCore = b[core] ?? [];
    const items = Math.max(aCore.length, bCore.length);
    if (aCore.length !== bCore.length) {
      errors.push(`(exp) ${aCore.length} !== ${bCore.length} (got) - length mismatch at Core[${core}] (${msg})`);
    }
    for (let i = 0; i < items; i++) {
      const a = aCore[i]?.toString();
      const b = bCore[i]?.toString();
      if (a !== b) {
        errors.push(`(exp) ${a} !== ${b} (got) at Core[${core}][${i}] (${msg})`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`\n${errors.join("\n")}`);
  }
}
