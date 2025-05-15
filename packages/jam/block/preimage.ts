import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { Blake2bHash } from "@typeberry/hash";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { ServiceId } from "./common";

export type PreimageHash = Opaque<Blake2bHash, "PreimageHash">;

/**
 * Service index (requester) and the data (blob).
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/181500181600
 */
export class Preimage extends WithDebug {
  static Codec = codec.Class(Preimage, {
    requester: codec.u32.asOpaque<ServiceId>(),
    blob: codec.blob,
  });
  static create({ requester, blob }: CodecRecord<Preimage>) {
    return new Preimage(requester, blob);
  }

  private constructor(
    /** The service which requested the preimage. */
    public readonly requester: ServiceId,
    /** The preimage data blob. */
    public readonly blob: BytesBlob,
  ) {
    super();
  }
}

/**
 * The lookup extrinsic is a sequence of pairs of service indices and data.
 *
 * These pairs must be ordered and without duplicates. The data must have been
 * solicited by a service but not yet be provided.
 */
export type PreimagesExtrinsic = Preimage[];

export const preimagesExtrinsicCodec = codec.sequenceVarLen(Preimage.Codec);
