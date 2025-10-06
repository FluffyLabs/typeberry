import { codecFixedSizeArray, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { O, Q } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import { codec, type SequenceView } from "@typeberry/codec";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { codecPerCore } from "./common.js";

/** `O`: Maximal authorization pool size. */
export const MAX_AUTH_POOL_SIZE = O;
export type MAX_AUTH_POOL_SIZE = typeof MAX_AUTH_POOL_SIZE;

/** `Q`: Size of the authorization queue. */
export const AUTHORIZATION_QUEUE_SIZE = Q;
export type AUTHORIZATION_QUEUE_SIZE = typeof AUTHORIZATION_QUEUE_SIZE;

/** A pool with authorization hashes that is filled from the queue.. */
export type AuthorizationPool = KnownSizeArray<AuthorizerHash, `At most ${typeof MAX_AUTH_POOL_SIZE}`>;

/**
 * A fixed-size queue of authorization hashes used to fill up the pool.
 *
 * Can be set using `ASSIGN` host call in batches of `AUTHORIZATION_QUEUE_SIZE`.
 */
export type AuthorizationQueue = FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>;

export const authPoolsCodec = codecPerCore<AuthorizationPool, SequenceView<AuthorizerHash>>(
  codecKnownSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), {
    minLength: 0,
    maxLength: MAX_AUTH_POOL_SIZE,
    typicalLength: MAX_AUTH_POOL_SIZE,
  }),
);

export const authQueuesCodec = codecPerCore<AuthorizationQueue, SequenceView<AuthorizerHash>>(
  codecFixedSizeArray(codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(), AUTHORIZATION_QUEUE_SIZE),
);
