import type { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";

/** A pool with authorization hashes that is filled from the queue.. */
export type AuthorizationPool = KnownSizeArray<AuthorizerHash, `At most ${typeof MAX_AUTH_POOL_SIZE}`>;

/**
 * A fixed-size queue of authorization hashes used to fill up the pool.
 *
 * Can be set using `ASSIGN` host call in batches of `AUTHORIZATION_QUEUE_SIZE`.
 */
export type AuthorizationQueue = FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>;
