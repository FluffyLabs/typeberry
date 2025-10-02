import type { WorkReportHash } from "@typeberry/block";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { HashSet, type ImmutableHashSet, type ImmutableSortedSet, SortedSet } from "@typeberry/collections";
import type { Ed25519Key } from "@typeberry/crypto";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

const sortedSetCodec = <T extends OpaqueHash>() =>
  readonlyArray(codec.sequenceVarLen(codec.bytes(HASH_SIZE))).convert<ImmutableSortedSet<T>>(
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

  static create({ goodSet, badSet, wonkySet, punishSet }: CodecRecord<DisputesRecords>) {
    return new DisputesRecords(goodSet, badSet, wonkySet, punishSet);
  }

  private readonly goodSetDict: ImmutableHashSet<WorkReportHash>;
  private readonly badSetDict: ImmutableHashSet<WorkReportHash>;
  private readonly wonkySetDict: ImmutableHashSet<WorkReportHash>;
  private readonly punishSetDict: ImmutableHashSet<Ed25519Key>;

  private constructor(
    /** `goodSet`: all work-reports hashes which were judged to be correct */
    public readonly goodSet: ImmutableSortedSet<WorkReportHash>,
    /** `badSet`: all work-reports hashes which were judged to be incorrect */
    public readonly badSet: ImmutableSortedSet<WorkReportHash>,
    /** `wonkySet`: all work-reports hashes which appear to be impossible to judge */
    public readonly wonkySet: ImmutableSortedSet<WorkReportHash>,
    /** `punishSet`: set of Ed25519 keys representing validators which were found to have misjudged a work-report */
    public readonly punishSet: ImmutableSortedSet<Ed25519Key>,
  ) {
    this.goodSetDict = HashSet.from(goodSet.array);
    this.badSetDict = HashSet.from(badSet.array);
    this.wonkySetDict = HashSet.from(wonkySet.array);
    this.punishSetDict = HashSet.from(punishSet.array);
  }

  public asDictionaries() {
    return {
      goodSet: this.goodSetDict,
      badSet: this.badSetDict,
      wonkySet: this.wonkySetDict,
      punishSet: this.punishSetDict,
    };
  }

  static fromSortedArrays({
    goodSet,
    badSet,
    wonkySet,
    punishSet,
  }: {
    goodSet: WorkReportHash[];
    badSet: WorkReportHash[];
    wonkySet: WorkReportHash[];
    punishSet: Ed25519Key[];
  }) {
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
