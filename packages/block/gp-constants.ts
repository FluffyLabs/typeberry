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
 * https://graypaper.fluffylabs.dev/#/364735a/3d22003d2200
 */

/** `I`: Maximum number of work items in a package. */
export const I = MAX_NUMBER_OF_WORK_ITEMS;

/** `K`: Max number of tickets which may be submitted in a single extrinsic. */
export const K = MAX_NUMBER_OF_TICKETS;

/** `O`: Maximum number of items in the authorizations pool. */
export const O = 8;

/** `Q`: The number of items in the authorizations queue. */
export const Q = 80;

/** `W_C`: The maximum size of service code in octets. */
export const W_C = 4_000_000;

/** `W_T`: The size of a transfer memo in octets. */
export const W_T = 128;

/** `Y`: The number of slots into an epoch at which ticket-submission ends. */
export const Y = 500;
