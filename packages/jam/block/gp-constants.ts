import { MAX_NUMBER_OF_TICKETS } from "./tickets";
import { MAX_NUMBER_OF_WORK_ITEMS } from "./work-package";

/**
 * This file lists all of the constants defined in the GrayPaper appendix.
 *
 * NOTE: Avoid using the constants directly, prefer "named" constants defined
 * in a semantical proximity to where they are used.
 *
 * NOTE: This file will most likely be removed in the future. The constants
 * here are only temporarily for convenience. When we figure out better names
 * and places for these this file will be eradicated.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/413000413000
 */

/** `I`: Maximum number of work items in a package. */
export const I = MAX_NUMBER_OF_WORK_ITEMS;

/** `K`: Max number of tickets which may be submitted in a single extrinsic. */
export const K = MAX_NUMBER_OF_TICKETS;

/** `O`: Maximum number of items in the authorizations pool. */
export const O = 8;

/** `Q`: The number of items in the authorizations queue. */
export const Q = 80;

/** `T`: The maximum number of extrinsics in a work-package. */
export const T = 128;

/** `V`: The total number of validators. */
export const V = 1_023;

/** `W_C`: The maximum size of service code in octets. */
export const W_C = 4_000_000;

/** `W_E`: The basic size of erasure-coded pieces in octets. */
export const W_E = 684;

/** `W_M`: The maximum number of imports and exports in a work-package. */
export const W_M = 3_072;

/** `W_P`: The number of erasure-coded pieces in a segment. */
export const W_P = 6;

/** `W_R`: The maximum total size of all output blobs in a work-report, in octets. */
export const W_R = 49_152;

/** `W_G`: W_P * W_E = 4104 The size of a segment in octets. */
export const W_G = W_P * W_E;

/** `W_T`: The size of a transfer memo in octets. */
export const W_T = 128;

/** `Y`: The number of slots into an epoch at which ticket-submission ends. */
export const Y = 500;

// TODO [ToDr] Not sure where these should live yet :(

/**
 * `J = 8`: The maximum sum of dependency items in a work-report.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/416a00416a00?v=0.6.2
 */
export const MAX_REPORT_DEPENDENCIES = 8;
export type MAX_REPORT_DEPENDENCIES = typeof MAX_REPORT_DEPENDENCIES;

/** Size of the authorization queue. */
export const AUTHORIZATION_QUEUE_SIZE = Q;
export type AUTHORIZATION_QUEUE_SIZE = typeof AUTHORIZATION_QUEUE_SIZE;

/** Maximal authorization pool size. */
export const MAX_AUTH_POOL_SIZE = O;
export type MAX_AUTH_POOL_SIZE = typeof MAX_AUTH_POOL_SIZE;
