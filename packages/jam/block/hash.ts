import type { OpaqueHash } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";

/**
 * Blake2B hash of JAM-encoding of some header.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0c7b000c7e00
 */
export type HeaderHash = Opaque<OpaqueHash, "HeaderHash">;

/** Blake2B hash of JAM-encoding of some work report. */
export type WorkReportHash = Opaque<OpaqueHash, "WorkReportHash">;

/**
 * Blake2B merkle commitment to the block's extrinsic data.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0ca1000ca400
 */
export type ExtrinsicHash = Opaque<OpaqueHash, "ExtrinsicHash">;

/** Blake2B hash of some service / authorization code. */
export type CodeHash = Opaque<OpaqueHash, "CodeHash">;
