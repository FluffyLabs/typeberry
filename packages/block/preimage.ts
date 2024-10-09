import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { ServiceId } from "./common";

/**
 * Service index (requester) and the data (blob).
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/153801154901
 */
export class Preimage {
  static Codec = codec.Class(Preimage, {
    requester: codec.u32.cast(),
    blob: codec.blob,
  });
  static fromCodec({ requester, blob }: CodecRecord<Preimage>) {
    return new Preimage(requester, blob);
  }

  constructor(
    public readonly requester: ServiceId,
    public readonly blob: BytesBlob,
  ) {}
}

/**
 * The lookup extrinsic is a sequence of pairs of service indices and data.
 *
 * These pairs must be ordered and without duplicates. The data must have been
 * solicited by a service but not yet be provided.
 */
export type PreimagesExtrinsic = Preimage[];

export const preimagesExtrinsicCodec = codec.sequenceVarLen(Preimage.Codec);
