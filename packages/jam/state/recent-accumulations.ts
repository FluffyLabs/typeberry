import { ServiceId } from "@typeberry/block";
import { codec, CodecRecord } from "@typeberry/codec";
import { HASH_SIZE, KeccakHash } from "@typeberry/hash";

export class RecentAccumulations {
  static Codec = codec.Class(RecentAccumulations, {
    service: codec.u32.asOpaque<ServiceId>(),
    belt: codec.optional(codec.bytes(HASH_SIZE)),
  });

  static create(a: CodecRecord<RecentAccumulations>) {
    return new RecentAccumulations(a.service, a.belt);
  }

  private constructor(
    readonly service: ServiceId,
    readonly belt: KeccakHash | null,
  ) {}
}
