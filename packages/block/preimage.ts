import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { ServiceId } from "./common";

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

export type PreimagesExtrinsic = Preimage[];
export const preimagesExtrinsicCodec = codec.sequenceVarLen(Preimage.Codec);
