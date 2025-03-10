import type { TimeSlot, WorkReportHash } from "@typeberry/block";
import { WorkReport } from "@typeberry/block/work-report";
import {CodecRecord, Descriptor, codec} from "@typeberry/codec";
import { OpaqueHash, WithHash, blake2b } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";

const codecWithHash = <T, V, H extends OpaqueHash>(val: Descriptor<T, V>): Descriptor<WithHash<H, T>, V> => new Descriptor(
  val.name,
  val.sizeHint,
  (e, elem) => val.encode(e, elem.data),
  (d): WithHash<H, T> => {
    const decoder2 = d.clone();
    const encoded = val.skipEncoded(decoder2);
    const hash = blake2b.hashBytes(encoded);
    return new WithHash(hash.asOpaque(), val.decode(d));
  },
  val.skip,
  val.View,
);

/**
 * Assignment of particular work report to a core.
 *
 * Used by "Assurances" and "Disputes" subsystem, denoted by `rho`
 * in state.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/135800135800
 */
export class AvailabilityAssignment extends WithDebug {
  static Codec = codec.Class(AvailabilityAssignment, {
    workReport: codecWithHash(WorkReport.Codec),
    timeout: codec.u32.asOpaque(),
  });

  static fromCodec({ workReport, timeout }: CodecRecord<AvailabilityAssignment>) {
    return new AvailabilityAssignment(workReport, timeout);
  }

  constructor(
    /** Work report assigned to a core. */
    public readonly workReport: WithHash<WorkReportHash, WorkReport>,
    /** Time slot at which the report becomes obsolete. */
    public readonly timeout: TimeSlot,
  ) {
    super();
  }
}
