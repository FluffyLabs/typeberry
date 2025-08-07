import { ServiceId } from "@typeberry/block";
import { codec, CodecRecord } from "@typeberry/codec";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";

/**
 * Single service-indexed commitment to accumulation output
 *
 * https://graypaper.fluffylabs.dev/#/1c979cb/170801171001?v=0.7.1
 * https://graypaper.fluffylabs.dev/#/1c979cb/182202182402?v=0.7.1
 */
export class AccumulationOutput {
  static Codec = codec.Class(AccumulationOutput, {
        serviceId: codec.u32.asOpaque<ServiceId>(),
        output: codec.optional(codec.bytes(HASH_SIZE)),
      });

  static create(a: CodecRecord<AccumulationOutput>) {
    return new AccumulationOutput(a.serviceId, a.output);
  }

  private constructor(
    readonly serviceId: ServiceId,
    readonly output: KeccakHash | null,
  ) {}
}

