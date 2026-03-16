import type { Bytes } from "@typeberry/bytes";
import { tryAsU16, type U16 } from "@typeberry/numbers";
import { asOpaqueType, type Opaque } from "@typeberry/utils";

/**
 * `W_E`: The basic size of erasure-coded pieces in octets. See equation H.6.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/449600449700?v=0.7.2
 */
export const W_E = 684;

/**
 * `W_P`: The size of an exported segment in erasure-coded pieces in octets.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/44b10044b200?v=0.7.2
 */
export const W_P = 6;

/**
 * `W_M`: The maximum number of imports in a work-package manifest.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/44ad0044ae00?v=0.7.2
 */
export const MAX_NUMBER_OF_IMPORTS_WP = 3072;

/**
 * `W_X`: The maximum number of exports in a work-package manifest.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/44be0044bf00?v=0.7.2
 */
export const MAX_NUMBER_OF_EXPORTS_WP = 3072;

/**
 * `W_G = W_E * W_S`: Exported segment size in bytes.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/449a00449b00?v=0.7.2
 */
export const SEGMENT_BYTES = W_E * W_P;
export type SEGMENT_BYTES = typeof SEGMENT_BYTES;

/** Exported segment data. */
export type Segment = Bytes<SEGMENT_BYTES>;

/** Index of an segment. */
export type SegmentIndex = Opaque<U16, "Segment Index [U16]">;
/** Attempt to convert a number into `SegmentIndex`. */
export const tryAsSegmentIndex = (v: number): SegmentIndex => asOpaqueType(tryAsU16(v));
