import type { ServiceId } from "@typeberry/block";
import { type CodecRecord, Descriptor, type SizeHint, codec } from "@typeberry/codec";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { tryAsServiceId } from "../../../dist/packages/jam/block/common.js";

const zeroSizeHint: SizeHint = {
  bytes: 0,
  isExact: true,
};

const ignoreValueWithDefault = <T>(defaultValue: T) =>
  Descriptor.new<T>(
    "ignoreValue",
    zeroSizeHint,
    (_, __) => {},
    (_) => defaultValue,
    (_) => {},
  );

export class RecentAccumulations {
  static Codec = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
    ? codec.Class(RecentAccumulations, {
        service: codec.u32.asOpaque<ServiceId>(),
        belt: codec.optional(codec.bytes(HASH_SIZE)),
      })
    : codec.Class(RecentAccumulations, {
        service: ignoreValueWithDefault(tryAsServiceId(0)),
        belt: ignoreValueWithDefault<KeccakHash | null>(null),
      });

  static create(a: CodecRecord<RecentAccumulations>) {
    return new RecentAccumulations(a.service, a.belt);
  }

  private constructor(
    readonly service: ServiceId,
    readonly belt: KeccakHash | null,
  ) {}
}
