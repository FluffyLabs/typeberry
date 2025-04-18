import type { Ed25519Key, WorkReportHash } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { SortedSet } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

const sortedSetCodec = <T extends OpaqueHash>() =>
  codec.sequenceVarLen(codec.bytes(HASH_SIZE)).convert<SortedSet<T>>(
    (input) => input.array,
    (output) => {
      const typed: T[] = output.map((x) => x.asOpaque());
      return SortedSet.fromSortedArray(hashComparator, typed);
    },
  );
const workReportsSortedSetCodec = sortedSetCodec<WorkReportHash>();

/**
 * A set of judgements over particular work reports identified by hashes.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/122b00124700
 */
export class DisputesRecords {
  static Codec = codec.Class(DisputesRecords, {
    goodSet: workReportsSortedSetCodec,
    badSet: workReportsSortedSetCodec,
    wonkySet: workReportsSortedSetCodec,
    punishSet: sortedSetCodec(),
  });

  static fromCodec({ goodSet, badSet, wonkySet, punishSet }: CodecRecord<DisputesRecords>) {
    return new DisputesRecords(goodSet, badSet, wonkySet, punishSet);
  }

  constructor(
    /** `goodSet`: all work-reports hashes which were judged to be correct */
    public goodSet: SortedSet<WorkReportHash>,
    /** `badSet`: all work-reports hashes which were judged to be incorrect */
    public badSet: SortedSet<WorkReportHash>,
    /** `wonkySet`: all work-reports hashes which appear to be impossible to judge */
    public wonkySet: SortedSet<WorkReportHash>,
    /** `punishSet`: set of Ed25519 keys representing validators which were found to have misjudged a work-report */
    public punishSet: SortedSet<Ed25519Key>,
  ) {}

  static fromSortedArrays(
    goodSet: WorkReportHash[],
    badSet: WorkReportHash[],
    wonkySet: WorkReportHash[],
    punishSet: Ed25519Key[],
  ) {
    return new DisputesRecords(
      SortedSet.fromSortedArray(hashComparator, goodSet),
      SortedSet.fromSortedArray(hashComparator, badSet),
      SortedSet.fromSortedArray(hashComparator, wonkySet),
      SortedSet.fromSortedArray(hashComparator, punishSet),
    );
  }
}

export function hashComparator<V extends OpaqueHash>(a: V, b: V) {
  return a.compare(b);
}
