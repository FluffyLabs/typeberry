import { BytesBlob } from "@typeberry/bytes";

/**
 * Hash prefix for internal nodes in both binary Merkle variants
 * (well-balanced and constant-depth) defined in GP Appendix E.1.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3fac013fac01?v=0.7.2
 */
export const NODE_HASH_PREFIX = BytesBlob.blobFromString("node");

/**
 * Hash prefix applied to each leaf by the constant-depth Merkle tree.
 * The well-balanced variant feeds raw leaves into the tree without
 * this prefix, so the two variants produce different roots for the
 * same input.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3ff5013ff501?v=0.7.2
 */
export const LEAF_HASH_PREFIX = BytesBlob.blobFromString("leaf");
