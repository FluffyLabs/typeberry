import type { ServiceId } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";

/**
 * Single service-indexed commitment to accumulation output
 *
 * https://graypaper.fluffylabs.dev/#/1c979cb/0f3c020f3e02?v=0.7.1
 */
export class AccumulationOutput {
  static Codec = codec.Class(AccumulationOutput, {
    serviceId: codec.u32.asOpaque<ServiceId>(),
    output: codec.bytes(HASH_SIZE),
  });

  static create(a: CodecRecord<AccumulationOutput>) {
    return new AccumulationOutput(a.serviceId, a.output);
  }

  private constructor(
    readonly serviceId: ServiceId,
    readonly output: KeccakHash,
  ) {}
}
