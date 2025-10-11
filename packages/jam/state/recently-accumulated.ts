import { codecPerEpochBlock, type PerEpochBlock } from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import { codec, type DescribedBy, type SequenceView } from "@typeberry/codec";
import { HashSet, type ImmutableHashSet } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";

export type RecentlyAccumulated = PerEpochBlock<ImmutableHashSet<WorkPackageHash>>;

export const recentlyAccumulatedCodec = codecPerEpochBlock<
  ImmutableHashSet<WorkPackageHash>,
  SequenceView<WorkPackageHash>
>(
  codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>()).convert(
    (x) => Array.from(x),
    (x) => HashSet.from(x),
  ),
);

export type RecentlyAccumulatedView = DescribedBy<typeof recentlyAccumulatedCodec.View>;
