import { MAX_NUMBER_OF_WORK_ITEMS } from "./work-package.js";

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

/** `G_I`: The gas allocated to invoke a work-package’s Is-Authorized logic. */
export const G_I = 50_000_000;

/** `I`: Maximum number of work items in a package. */
export const I = MAX_NUMBER_OF_WORK_ITEMS;

/** `O`: Maximum number of items in the authorizations pool. */
export const O = 8;

/** `Q`: The number of items in the authorizations queue. */
export const Q = 80;

/** `S`: The maximum number of entries in the accumulation queue. */
export const S = 1024;

/** `T`: The maximum number of extrinsics in a work-package. */
export const T = 128;

/** `W_A`: The maximum size of is-authorized code in octets. */
export const W_A = 64_000;

/** `W_B`: The maximum size of an encoded work-package with extrinsic data and imports. */
export const W_B = 13_794_305;

/** `W_C`: The maximum size of service code in octets. */
export const W_C = 4_000_000;

/** `W_M`: The maximum number of imports in a work-package. */
export const W_M = 3_072;

/** `W_R`: The maximum total size of all output blobs in a work-report, in octets. */
export const W_R = 49_152;

/** `W_T`: The size of a transfer memo in octets. */
export const W_T = 128;

/** `W_M`: The maximum number of exports in a work-package. */
export const W_X = 3_072;

// TODO [ToDr] Not sure where these should live yet :(

/**
 * `S`: The minimum public service index.
 * Services of indices below these may only be created by the Registrar.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/447a00447a00?v=0.7.2
 */
export const MIN_PUBLIC_SERVICE_INDEX = 2 ** 16;

/**
 * `J`: The maximum sum of dependency items in a work-report.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/416a00416a00?v=0.6.2
 */
export const MAX_REPORT_DEPENDENCIES = 8;
export type MAX_REPORT_DEPENDENCIES = typeof MAX_REPORT_DEPENDENCIES;
