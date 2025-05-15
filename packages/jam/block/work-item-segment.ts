import type { Bytes } from "@typeberry/bytes";
import { type U16, tryAsU16 } from "@typeberry/numbers";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/** `W_E`: The basic size of erasure-coded pieces in octets. See equation H.6. */
const W_E = 684;

/** `W_S`: The size of an exported segment in erasure-coded pieces in octets. */
const W_S = 6;

/** `W_M`: The maximum number of entries in a work-package manifest. */
export const MAX_NUMBER_OF_SEGMENTS = 2048; // 2**11

/** `W_E * W_S`: Exported segment size in bytes. */
export const SEGMENT_BYTES = W_E * W_S;
export type SEGMENT_BYTES = typeof SEGMENT_BYTES;

/** Exported segment data. */
export type Segment = Bytes<SEGMENT_BYTES>;

/** Index of an segment. */
export type SegmentIndex = Opaque<U16, "Segment Index [U16]">;
/** Attempt to convert a number into `SegmentIndex`. */
export const tryAsSegmentIndex = (v: number): SegmentIndex => asOpaqueType(tryAsU16(v));
