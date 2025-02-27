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

/** `B_I`: The additional minimum balance required per item of elective service state. */
export const B_I = 10;

/** `B_L`: The additional minimum balance required per octet of elective service state. */
export const B_L = 1;

/** `B_S`: The basic minimum balance which all services require. */
export const B_S = 100;

/** `C`: The total number of cores. */
export const C = 341;

/** `D`: The period in timeslots after which an unreferenced preimage may be expunged. */
export const D = 19_200;

/** `E`: The length of an epoch in timeslots. */
export const E = 600;

/** `G_A`: The gas allocated to invoke a work-report’s Accumulation logic. */
export const G_A = 10_000_000;

/** `G_I`: The gas allocated to invoke a work-package’s Is-Authorized logic. */
export const G_I = 50_000_000;

/** `G_R`: The gas allocated to invoke a work-package’s Refine logic. */
export const G_R = 5_000_000_000;

/** `G_T`: The total gas allocated across all Accumulation. */
export const G_T = 3_500_000_000;

/** `H`: The size of recent history, in blocks. */
export const H = 8;

/** `I`: Maximum number of work items in a package. */
export const I = MAX_NUMBER_OF_WORK_ITEMS;

/** `J`: The maximum sum of dependency items in a work-report. */
export const J = 8;

/** `K`: Max number of tickets which may be submitted in a single extrinsic. */
export const K = MAX_NUMBER_OF_TICKETS;

/** `L`: The maximum age in timeslots of the lookup anchor. */
export const L = 14_400;

/** `O`: Maximum number of items in the authorizations pool. */
export const O = 8;

/** `P`: The slot period, in seconds. */
export const P = 6;

/** `Q`: The number of items in the authorizations queue. */
export const Q = 80;

/** `R`: The rotation period of validator-core assignments, in timeslots. */
export const R = 10;

/** `S`: The maximum number of entries in the accumulation queue. */
export const S = 1024;

/** `T`: The maximum number of extrinsics in a work-package. */
export const T = 128;

/** `U`: The period in timeslots after which reported but unavailable work may be replaced. */
export const U = 5;

/** `V`: The total number of validators. */
export const V = 1023;

/** `W_A`: The maximum size of is-authorized code in octets. */
export const W_A = 64_000;

/** `W_B`: The maximum size of an encoded work-package with extrinsic data and imports. */
export const W_B = 12 * 2 ** 20;

/** `W_C`: The maximum size of service code in octets. */
export const W_C = 4_000_000;

/** `W_E`: The basic size of erasure-coded pieces in octets. */
export const W_E = 684;

/** `W_M`: The maximum number of imports in a work-package. */
export const W_M = 3_072;

/** `W_P`: The number of erasure-coded pieces in a segment. */
export const W_P = 6;

/** `W_R`: The maximum total size of all output blobs in a work-report, in octets. */
export const W_R = 49_152;

/** `W_G`: W_P * W_E = 4104 The size of a segment in octets. */
export const W_G = W_P * W_E;

/** `W_T`: The size of a transfer memo in octets. */
export const W_T = 128;

/** `W_M`: The maximum number of exports in a work-package. */
export const W_X = 3_072;

/** `Y`: The number of slots into an epoch at which ticket-submission ends. */
export const Y = 500;

// TODO [ToDr] Not sure where these should live yet :(

/**
 * `J`: The maximum sum of dependency items in a work-report.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/416a00416a00?v=0.6.2
 */
export const MAX_REPORT_DEPENDENCIES = 8;
export type MAX_REPORT_DEPENDENCIES = typeof MAX_REPORT_DEPENDENCIES;

/** `Q`: Size of the authorization queue. */
export const AUTHORIZATION_QUEUE_SIZE = Q;
export type AUTHORIZATION_QUEUE_SIZE = typeof AUTHORIZATION_QUEUE_SIZE;

/** `O`: Maximal authorization pool size. */
export const MAX_AUTH_POOL_SIZE = O;
export type MAX_AUTH_POOL_SIZE = typeof MAX_AUTH_POOL_SIZE;
