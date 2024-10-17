import type { Bytes } from "@typeberry/bytes";
import type { HASH_SIZE } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";
export { HASH_SIZE } from "@typeberry/hash";

/**
 * Blake2B hash of JAM-encoding of some header.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c5f000c6300
 */
export type HeaderHash = Opaque<Bytes<typeof HASH_SIZE>, "HeaderHash">;

/** Blake2B hash of JAM-encoding of some work report. */
export type WorkReportHash = Opaque<Bytes<typeof HASH_SIZE>, "WorkReportHash">;

/**
 * Blake2B hash of JAM-encoding of all extrinsics concatenated.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0c84000c8d00
 */
export type ExtrinsicHash = Opaque<Bytes<typeof HASH_SIZE>, "ExtrinsicHash">;

/** Blake2B hash of some service / authorization code. */
export type CodeHash = Opaque<Bytes<typeof HASH_SIZE>, "CodeHash">;
