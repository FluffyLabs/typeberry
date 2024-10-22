import type { OpaqueHash } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";

/**
 * Blake2B hash of JAM-encoding of some header.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c5f000c6300
 */
export type HeaderHash = Opaque<OpaqueHash, "HeaderHash">;

/** Blake2B hash of JAM-encoding of some work report. */
export type WorkReportHash = Opaque<OpaqueHash, "WorkReportHash">;

/**
 * Blake2B hash of JAM-encoding of all extrinsics concatenated.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c84000c8d00
 */
export type ExtrinsicHash = Opaque<OpaqueHash, "ExtrinsicHash">;

/** Blake2B hash of some service / authorization code. */
export type CodeHash = Opaque<OpaqueHash, "CodeHash">;
